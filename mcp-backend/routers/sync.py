"""
Sync Router — AGENT-3a | REQ-031
Bidirectional Google People API sync stubs.
"""
from fastapi import APIRouter, Request, HTTPException, Depends
from services.google_people_service import GooglePeopleService
from db.supabase_client import get_supabase
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

class SyncRequest(BaseModel):
    access_token: Optional[str] = None
    user_id: str

@router.post("/google")
async def trigger_google_sync(sync_req: SyncRequest):
    """REQ-031: POST /api/v1/sync/google — Trigger bidirectional contact sync."""
    supabase = get_supabase()
    sync_service = GooglePeopleService(supabase)
    
    try:
        # Pass the access token to the Google People service for processing
        result = await sync_service.sync_contacts(
            user_id=sync_req.user_id,
            access_token=sync_req.access_token or None
        )
        # Return structured stats: {status, stats: {created, updated, errors}, total_found}
        return result
    except Exception as e:
        err_str = str(e)
        # Authentication errors are expected before Google OAuth is configured
        if "Authentication required" in err_str or "No valid tokens" in err_str:
            return {
                "status": "auth_required",
                "message": "Google OAuth not yet configured. Run 'Connect Google Account' to enable sync.",
                "stats": {"created": 0, "updated": 0, "errors": 0},
                "total_found": 0
            }
        raise HTTPException(status_code=500, detail=err_str)

@router.get("/status")
async def get_sync_status(req: Request):
    """Return status of ongoing sync jobs."""
    return {"status": "IDLE", "last_sync_at": None}
