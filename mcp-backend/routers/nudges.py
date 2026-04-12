from fastapi import APIRouter, Request, HTTPException
from typing import List, Dict, Any
from datetime import datetime, timezone
from services.health_service import update_contact_health, calculate_health_score

router = APIRouter()

@router.get("/")
@router.get("")
async def get_active_nudges(req: Request):
    """
    REQ-035: GET /api/v1/nudges — Fetch contacts needing immediate attention.
    Scans for low health scores or stale relationships.
    """
    db = getattr(req.app.state, "supabase", None)
    if not db:
        raise HTTPException(status_code=503, detail="Database not available")

    try:
        response = db.table("contacts") \
            .select("id, first_name, last_name, health_score, last_contact_at, email, phone") \
            .or_("health_score.lt.40, last_contact_at.lt.now()-interval '21 days'") \
            .order("health_score", desc=False) \
            .limit(10) \
            .execute()
        
        nudges = []
        for contact in response.data:
            first_name = contact.get("first_name", "Unknown")
            last_name = contact.get("last_name", "")
            full_name = f"{first_name} {last_name}".strip()
            
            nudge = {
                "id": contact["id"],
                "contact_id": contact["id"],
                "contact_name": full_name,
                "type": "FOLLOW_UP" if contact["health_score"] < 40 else "RECONNECT",
                "reason": "Relationship score dropping" if contact["health_score"] < 40 else "Last engagement was >3 weeks ago",
                "suggested_action": "Reach out via email" if contact["email"] else "Send a follow-up text",
                "due_in": "2h" if contact["health_score"] < 20 else "1d",
                "priority_score": 100 - contact["health_score"],
                "email": contact.get("email"),
                "phone": contact.get("phone")
            }
            nudges.append(nudge)

        return {
            "status": "success", 
            "data": nudges, 
            "count": len(nudges)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/refresh/{contact_id}")
async def refresh_nudge_status(req: Request, contact_id: str):
    """Recalculate health for a specific contact."""
    try:
        update_contact_health(contact_id)
        return {"status": "success", "new_score": calculate_health_score(contact_id)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/refresh-all")
async def refresh_all_nudges(req: Request):
    """Recalculate health for all contacts."""
    from services.health_service import refresh_all_health_scores
    try:
        refresh_all_health_scores()
        return {"status": "success", "message": "Global health refresh complete"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
