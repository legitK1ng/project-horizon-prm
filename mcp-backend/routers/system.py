from fastapi import APIRouter, Request, HTTPException
from typing import List, Dict
import os
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Health deep (v_system_health view) ───────────────────────────────────────

@router.get("/health-deep")
async def health_deep(req: Request):
    """
    Live pipeline health snapshot from the v_system_health Supabase view.
    Returns counts for pending/processing/completed/error call_records,
    total contacts, recent pipeline_events, and enrichment job status.
    """
    db = getattr(req.app.state, "supabase", None)
    if not db:
        raise HTTPException(status_code=503, detail="Database not available")

    try:
        result = db.rpc("query_view", {"view_name": "v_system_health"}).execute()
        # Some Supabase setups don't support rpc() for views — fall back to direct select
        if not result.data:
            raise Exception("rpc empty — using direct select fallback")
        return {"status": "success", "data": result.data}
    except Exception:
        pass

    # Direct select fallback (most reliable path)
    try:
        result = db.table("v_system_health").select("*").execute()
        return {"status": "success", "data": result.data}
    except Exception as e:
        # v_system_health view may not be available via PostgREST — query raw tables
        logger.warning(f"[SYSTEM] v_system_health view not accessible via REST: {e}. Running raw queries.")

    try:
        from datetime import datetime, timezone, timedelta

        # Aggregate call_records pipeline stats
        pending    = db.table("call_records").select("id", count="exact").eq("status", "pending").execute().count or 0
        processing = db.table("call_records").select("id", count="exact").eq("status", "processing").execute().count or 0
        completed  = db.table("call_records").select("id", count="exact").eq("status", "completed").execute().count or 0
        error      = db.table("call_records").select("id", count="exact").eq("status", "error").execute().count or 0
        total_records = (pending or 0) + (processing or 0) + (completed or 0) + (error or 0)

        # Contacts count
        contacts_count = db.table("contacts").select("id", count="exact").execute().count or 0

        # Recent pipeline events (last hour)
        one_hour_ago = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
        recent_events = db.table("pipeline_events").select("source,status,emitted_at,error") \
            .gte("emitted_at", one_hour_ago) \
            .order("emitted_at", desc=True) \
            .limit(20) \
            .execute().data or []

        recent_errors = [e for e in recent_events if e.get("status") == "error"]

        return {
            "status": "success",
            "data": {
                "pipeline": {
                    "pending":    pending,
                    "processing": processing,
                    "completed":  completed,
                    "error":      error,
                    "total":      total_records,
                },
                "contacts":      contacts_count,
                "recent_events": recent_events,
                "error_count_1h": len(recent_errors),
                "health":        "degraded" if len(recent_errors) > 5 else "ok",
            }
        }
    except Exception as e:
        logger.error(f"[SYSTEM] health-deep fallback queries failed: {e}")
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")

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
