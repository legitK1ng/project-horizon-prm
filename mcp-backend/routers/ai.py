"""
AI Router — AGENT-3a | REQ-022, REQ-027
Handles contextual chat and specialized AI interactions.
"""
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import logging

from services.ai_briefing_service import _get_model, generate_call_brief

logger = logging.getLogger(__name__)
router = APIRouter()

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []
    context_id: Optional[str] = None # can be a contact_id or call_id

@router.post("/chat")
async def ai_chat(req: Request, body: ChatRequest):
    """
    REQ-027: Contextual Assistant Chat.
    Uses Gemini to answer user queries, optionally injecting contact context.
    """
    supabase = getattr(req.app.state, "supabase", None)
    
    system_prompt = (
        "You are the Horizon PRM Assistant, a sophisticated Strategic Consultant. "
        "Your goal is to help the user manage their relationships with intelligence and proactive nudges. "
        "Be professional, concise, and helpful."
    )
    
    context_text = ""
    if body.context_id:
        try:
            # Try fetching contact context
            contact_resp = supabase.table("contacts").select("*").eq("id", body.context_id).execute()
            if contact_resp.data:
                c = contact_resp.data[0]
                context_text = f"\n[CONTEXT: CONTACT]\nName: {c.get('first_name')} {c.get('last_name')}\nOrganization: {c.get('organization')}\nHealth Score: {c.get('health_score')}\nEmail: {c.get('email')}"
            else:
                # Try fetching call context if contact not found
                call_resp = supabase.table("call_records").select("*").eq("id", body.context_id).execute()
                if call_resp.data:
                    call = call_resp.data[0]
                    context_text = f"\n[CONTEXT: CALL]\nContact: {call.get('contact_name')}\nSummary: {call.get('executive_brief', {}).get('summary')}\nTranscript: {call.get('transcript')[:500]}..."
        except Exception as e:
            logger.warning(f"Failed to fetch context for {body.context_id}: {e}")

    try:
        model = _get_model()
        full_prompt = f"{system_prompt}\n{context_text}\n\nUser: {body.message}"
        
        # Simple generation for now (stateless chat)
        response = model.generate_content(full_prompt)
        
        return {
            "status": "success",
            "message": response.text.strip(),
            "context_used": bool(context_text)
        }
    except Exception as e:
        logger.error(f"AI Chat Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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
