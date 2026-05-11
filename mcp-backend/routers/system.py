from fastapi import APIRouter, Request, HTTPException
from typing import List, Dict
import os
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/models")
async def get_models():
    """
    Returns available models for the frontend selection.
    """
    return {
        "models": [
            {"name": "gemini-2.5-flash", "displayName": "Gemini 2.5 Flash (Default)"},
            {"name": "gemini-2.0-pro", "displayName": "Gemini 2.0 Pro"},
            {"name": "whisper-v3", "displayName": "Faster Whisper v3"}
        ]
    }

@router.get("/diagnostics")
async def run_diagnostics(req: Request):
    """
    Runs several health checks.
    """
    supabase = getattr(req.app.state, "supabase", None)
    whisper = getattr(req.app.state, "whisper", None)
    
    results = [
        {"name": "Database", "status": "UP" if supabase else "DOWN"},
        {"name": "AI Engine (Whisper)", "status": "READY" if whisper else "INITIALIZING"},
        {"name": "Environment", "status": "OK" if os.getenv("GOOGLE_API_KEY") else "MISSING_KEYS"}
    ]
    
    return {"status": "success", "results": results}

@router.get("/test-gemini")
async def test_gemini_connection():
    """
    Simple test call to Gemini.
    """
    from services.ai_briefing_service import _get_model
    try:
        model = _get_model()
        response = model.generate_content("Hello. Respond with 'Gemini Online'.")
        return {"status": "success", "message": response.text.strip()}
    except Exception as e:
        logger.error(f"[SYSTEM] Gemini test failed: {e}")
        return {"status": "error", "message": str(e)}

@router.get("/trigger-processing")
async def trigger_processing():
    """
    Stub for manual processing trigger.
    """
    return {"status": "success", "message": "Background processing triggered (Stub)"}

@router.post("/analyze")
async def analyze_text(req: Request):
    """
    Direct text analysis using Gemini.
    """
    from services.ai_briefing_service import generate_call_brief
    body = await req.json()
    transcript = body.get("transcript")
    if not transcript:
        raise HTTPException(status_code=400, detail="Missing transcript")
    
    try:
        result = generate_call_brief(transcript, "Direct Analysis")
        return {"status": "success", "data": result}
    except Exception as e:
        logger.error(f"[SYSTEM] Analysis failed: {e}")
        return {"status": "error", "message": str(e)}

@router.get("/tags")
async def get_tags(req: Request):
    """
    Returns available tags for the frontend.
    """
    db = getattr(req.app.state, "supabase", None)
    default_tags = ["Follow-up", "Urgent", "Sales", "Personal", "Meeting", "Strategic", "Networking"]
    
    if not db:
        return {"tags": default_tags}
    
    try:
        # Aggregate tags from existing records
        response = db.table("call_records").select("tags").execute()
        tags_set = set(default_tags)
        for record in response.data:
            record_tags = record.get("tags")
            if record_tags and isinstance(record_tags, list):
                for t in record_tags:
                    tags_set.add(t)
        
        return {"status": "success", "tags": sorted(list(tags_set))}
    except Exception as e:
        logger.warning(f"[SYSTEM] Failed to fetch tags from DB: {e}")
        return {"status": "success", "tags": sorted(default_tags)}
