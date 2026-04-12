"""
API Routers — AGENT-3a | REQ-014, REQ-016
All routes versioned under /api/v1/ via FastAPI APIRouter.
"""

# ─── routers/health.py ────────────────────────────────────────────
from fastapi import APIRouter, Request

router = APIRouter()

@router.get("")
@router.get("/")
def health_check(request: Request):
    """REQ-014: Required health endpoint for Cloud Run readiness probe."""
    supabase = getattr(request.app.state, "supabase", None)
    whisper = getattr(request.app.state, "whisper", None)
    return {
        "status": "ok",
        "version": "1.0.0",
        "db_connected": supabase is not None,
        "whisper_ready": whisper is not None
    }
