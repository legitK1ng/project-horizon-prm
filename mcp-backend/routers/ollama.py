"""
Ollama Router — Item 5
Cloud inference via minimax-m2.7:cloud through the local Ollama daemon.
Zero local VRAM — MiniMax handles inference remotely.
Embeddings use Google text-embedding-004.

API pattern follows the same /api/chat endpoint used by Ollama launch agents
(Claude Code, Codex, OpenCode, Droid).
"""
import logging
from typing import List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from services.ollama_service import (
    generate,
    chat,
    process_transcript,
    list_models,
    health_check,
    DEFAULT_MODEL,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Request Models ───────────────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=1)
    model:  str = Field(default=DEFAULT_MODEL)
    system: str = Field(default="")


class ChatMessage(BaseModel):
    role:    str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    model:    str = Field(default=DEFAULT_MODEL)
    system:   str = Field(default="")


class TranscriptRequest(BaseModel):
    transcript:   str = Field(..., min_length=10)
    contact_name: str = Field(default="Unknown")
    model:        str = Field(default=DEFAULT_MODEL)


# ── Routes ───────────────────────────────────────────────────────────────────

@router.get("/health")
async def ollama_health():
    """Verify Ollama daemon is reachable. Cloud model runs on MiniMax servers."""
    result = await health_check()
    if result["status"] != "ok":
        raise HTTPException(status_code=503, detail=result)
    return result


@router.get("/models")
async def get_models():
    """List all models registered in Ollama (local + cloud)."""
    models = await list_models()
    return {
        "models":        models,
        "count":         len(models),
        "default_model": DEFAULT_MODEL,
    }


@router.post("/generate")
async def generate_text(req: GenerateRequest):
    """Single-turn generation via minimax-m2.7:cloud (cloud-hosted, no VRAM)."""
    try:
        response = await generate(req.prompt, model=req.model, system=req.system)
        return {"response": response, "model": req.model}
    except Exception as e:
        logger.error(f"[Ollama] /generate failed: {e}")
        raise HTTPException(
            status_code=502,
            detail=f"Ollama error: {e} — ensure `ollama serve` is running.",
        )


@router.post("/chat")
async def chat_endpoint(req: ChatRequest):
    """
    Multi-turn chat via /api/chat — same pattern used by Ollama launch agents.
    Accepts OpenAI-style messages list.
    """
    try:
        msgs = [{"role": m.role, "content": m.content} for m in req.messages]
        reply = await chat(msgs, model=req.model, system=req.system)
        return {"response": reply, "model": req.model}
    except Exception as e:
        logger.error(f"[Ollama] /chat failed: {e}")
        raise HTTPException(status_code=502, detail=f"Ollama error: {e}")


@router.post("/process-transcript")
async def process_transcript_endpoint(req: TranscriptRequest):
    """
    Item 5 / 15 — Full transcript pipeline via minimax-m2.7:cloud:
      diarization → structuring → summary → action items → entities.
    """
    try:
        result = await process_transcript(req.transcript, model=req.model)
        return {"status": "ok", "data": result, "model": req.model}
    except Exception as e:
        logger.error(f"[Ollama] /process-transcript failed: {e}")
        raise HTTPException(status_code=502, detail=f"Transcript processing error: {e}")
