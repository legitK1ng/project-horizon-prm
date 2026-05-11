"""
AI Router — AGENT-3a | REQ-022, REQ-027
Handles contextual chat and specialized AI interactions.
Chat: gudzenkoi/kimi-k2:1t-cloud via Ollama (free, remote host, no VRAM).
Embeddings: Google text-embedding-004 (cloud API).
"""
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import logging

from services.ai_briefing_service import (
    generate_call_brief,
    process_transcript_gemini,
    generate_embedding,
    chat_gemini_sync,
)
from services.embedding_service import embed_query as semantic_embed_query
import asyncio

logger = logging.getLogger(__name__)
router = APIRouter()

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []
    context_id: Optional[str] = None  # contact_id or call_id

async def _build_live_context(supabase, context_id: str | None, user_message: str = "") -> str:
    """
    Build RAG context for the AI assistant.
    - Semantic search over call_records (if embeddings exist) — most relevant calls to the query
    - Falls back to recency-based context when no embeddings available
    - Top contacts by health score
    - Focused entity when context_id is provided
    """
    parts: list[str] = []

    # ── Semantic call retrieval (RAG) ─────────────────────────────────────────
    semantic_ids: set[str] = set()
    if user_message and supabase:
        try:
            query_vec = semantic_embed_query(user_message)
            if query_vec:
                rpc_resp = supabase.rpc("search_calls_semantic", {
                    "query_embedding": query_vec,
                    "match_count": 5,
                    "min_similarity": 0.25,
                }).execute()
                if rpc_resp.data:
                    lines = []
                    for r in rpc_resp.data:
                        brief = r.get("executive_brief") or {}
                        summary = brief.get("summary", "No summary")[:150]
                        ts = (r.get("call_timestamp") or "")[:10]
                        sim = round(r.get("similarity", 0), 2)
                        lines.append(
                            f"  • [{sim}] {ts} | {r.get('contact_name')} | "
                            f"{r.get('sentiment','?')} | {summary}"
                        )
                        semantic_ids.add(str(r.get("id")))
                    parts.append("[SEMANTICALLY RELEVANT CALLS]\n" + "\n".join(lines))
        except Exception as e:
            logger.warning(f"[AI] semantic call search failed: {e}")

    # ── Recent calls fallback (fills gaps when semantic returns < 3) ──────────
    try:
        recent_resp = supabase.table("call_records").select(
            "id, contact_name, timestamp, executive_brief, sentiment, tags"
        ).order("timestamp", desc=True).limit(5).execute()

        if recent_resp.data:
            lines = []
            for c in recent_resp.data:
                if str(c.get("id")) in semantic_ids:
                    continue  # already shown in semantic section
                brief = c.get("executive_brief") or {}
                summary = brief.get("summary", "No summary")[:120]
                ts = (c.get("timestamp") or "")[:10]
                lines.append(f"  • {ts} | {c.get('contact_name')} | {c.get('sentiment','?')} | {summary}")
            if lines:
                parts.append("[RECENT CALLS]\n" + "\n".join(lines))
    except Exception as e:
        logger.warning(f"[AI] recent calls fetch failed: {e}")

    # ── Top contacts ─────────────────────────────────────────────────────────
    try:
        contacts_resp = supabase.table("contacts").select(
            "first_name, last_name, organization, health_score, last_contact_at, email"
        ).order("health_score", desc=True).limit(10).execute()

        if contacts_resp.data:
            lines = []
            for c in contacts_resp.data:
                name = f"{c.get('first_name','')} {c.get('last_name') or ''}".strip()
                org  = c.get("organization") or ""
                hs   = c.get("health_score") or 0
                lc   = (c.get("last_contact_at") or "never")[:10]
                lines.append(f"  • {name} | {org} | score={hs} | last={lc}")
            parts.append("[TOP CONTACTS]\n" + "\n".join(lines))
    except Exception as e:
        logger.warning(f"[AI] contacts fetch failed: {e}")

    # ── Focused entity (contact_id or call_id) ────────────────────────────────
    if context_id and supabase:
        try:
            contact_resp = supabase.table("contacts").select("*").eq("id", context_id).execute()
            if contact_resp.data:
                c = contact_resp.data[0]
                parts.append(
                    f"[FOCUSED CONTACT]\nName: {c.get('first_name')} {c.get('last_name')}\n"
                    f"Organization: {c.get('organization')}\nHealth Score: {c.get('health_score')}\n"
                    f"Email: {c.get('email')}\nPhone: {c.get('phone')}\nNotes: {c.get('notes','')}"
                )
            else:
                call_resp = supabase.table("call_records").select("*").eq("id", context_id).execute()
                if call_resp.data:
                    call = call_resp.data[0]
                    brief = call.get("executive_brief") or {}
                    parts.append(
                        f"[FOCUSED CALL]\nContact: {call.get('contact_name')}\n"
                        f"Summary: {brief.get('summary', '')}\n"
                        f"Action Items: {', '.join(brief.get('action_items', []))}\n"
                        f"Transcript: {(call.get('transcript') or '')[:800]}"
                    )
        except Exception as e:
            logger.warning(f"[AI] focused context fetch failed for {context_id}: {e}")

    return "\n\n".join(parts)


@router.post("/chat")
async def ai_chat(req: Request, body: ChatRequest):
    """
    REQ-027: Contextual Assistant Chat.
    Routes through Gemini 2.0 Flash instead of Ollama.
    Always injects live PRM state (recent calls + contacts) into every request.
    """
    supabase = getattr(req.app.state, "supabase", None)

    system_prompt = (
        "You are the Horizon PRM Assistant, a sophisticated Strategic Consultant. "
        "Your goal is to help the user manage their relationships with intelligence and proactive nudges. "
        "You have live access to the user's contact database and recent call history (provided below). "
        "Use this data to give specific, actionable advice. Be professional, concise, and helpful."
    )

    context_text = ""
    if supabase:
        context_text = await _build_live_context(supabase, body.context_id, body.message)
        if context_text:
            context_text = f"\n\n[LIVE PRM DATA — {__import__('datetime').date.today()}]\n{context_text}"

    full_prompt = f"{system_prompt}{context_text}\n\nUser: {body.message}\nAssistant:"

    try:
        reply = await asyncio.to_thread(chat_gemini_sync, full_prompt)
        return {
            "status": "success",
            "message": reply.strip(),
            "model": "gemini-2.0-flash",
            "context_used": bool(context_text),
        }
    except Exception as e:
        logger.error(f"[AI] chat error: {e}")
        raise HTTPException(status_code=502, detail=f"Gemini error: {e}")

@router.post("/analyze")
async def analyze_text(req: Request):
    """Direct text analysis (migrated from system router)."""
    body = await req.json()
    transcript = body.get("transcript")
    if not transcript:
        raise HTTPException(status_code=400, detail="Missing transcript")

    try:
        result = generate_call_brief(transcript, "Direct Analysis")
        return {"status": "success", "data": result}
    except Exception as e:
        logger.error(f"Analysis failed: {e}")
        return {"status": "error", "message": str(e)}


class TranscriptRequest(BaseModel):
    transcript: str
    contact_name: str = "Unknown"


class EmbedRequest(BaseModel):
    text: str


@router.post("/process-transcript")
async def process_transcript(body: TranscriptRequest):
    """
    Item 5 / 15 — Full transcript pipeline via Gemini 1.5 Flash.
    Speaker structuring → summary → action items → entity extraction.
    """
    try:
        result = process_transcript_gemini(body.transcript, body.contact_name)
        return {"status": "success", "data": result}
    except Exception as e:
        logger.error(f"[AI] process-transcript failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/embed")
async def embed_text(body: EmbedRequest):
    """
    Item 14 — Generate a 768-dim embedding via Google text-embedding-004.
    Used for semantic search over contacts, transcripts, tasks, and projects.
    """
    try:
        embedding = generate_embedding(body.text)
        return {"embedding": embedding, "dims": len(embedding), "model": "text-embedding-004"}
    except Exception as e:
        logger.error(f"[AI] embed failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
