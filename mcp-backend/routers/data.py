"""
Data Router — Unified dashboard stats endpoint.
Computes real avgHealth from the contacts table.
Only counts calls from the last 7 days for "active calls".
"""
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Request, HTTPException

router = APIRouter()

@router.get("/")
@router.get("")
async def get_all_dashboard_data(req: Request):
    """
    Unified endpoint for dashboard KPI stats.
    - totalContacts: count from contacts table
    - callsThisWeek: calls in last 7 days
    - avgHealth: real average of non-zero health scores (for contacts with call history)
    - needsAttention: count of contacts with health < 40 and at least one call
    """
    db = getattr(req.app.state, "supabase", None)
    if not db:
        raise HTTPException(status_code=503, detail="Database not available")

    try:
        # Total contact count (uses count="exact" for efficiency)
        contacts_count_resp = db.table("contacts").select("id", count="exact").execute()
        total_contacts = contacts_count_resp.count if hasattr(contacts_count_resp, 'count') and contacts_count_resp.count else len(contacts_count_resp.data)

        # Calls this week
        week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        calls_resp = db.table("call_records").select("id", count="exact").gte("timestamp", week_ago).execute()
        calls_this_week = calls_resp.count if hasattr(calls_resp, 'count') and calls_resp.count else len(calls_resp.data)

        # Real avgHealth — average of contacts that have been scored (health_score > 0)
        health_resp = db.table("contacts").select("health_score").gt("health_score", 0).execute()
        scored_contacts = health_resp.data
        if scored_contacts:
            avg_health = round(sum(c["health_score"] for c in scored_contacts) / len(scored_contacts))
        else:
            avg_health = 0  # No scored contacts yet — honest zero, not fake 84

        # Contacts needing attention (health 1-39, non-zero)
        needs_attention_resp = db.table("contacts").select("id", count="exact").gt("health_score", 0).lt("health_score", 40).execute()
        needs_attention = needs_attention_resp.count if hasattr(needs_attention_resp, 'count') and needs_attention_resp.count else len(needs_attention_resp.data)

        return {
            "status": "success",
            "totalContacts": total_contacts,
            "callsThisWeek": calls_this_week,
            "avgHealth": avg_health,
            "needsAttention": needs_attention,
        }
    except Exception as e:
        print(f"[DATA] Error fetching dashboard data: {e}")
        raise HTTPException(status_code=500, detail=str(e))
