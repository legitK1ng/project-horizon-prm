"""
Digest Router — AGENT-3a | REQ-006
Weekly digest endpoint backed by Gemini server-side.
"""
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Request, HTTPException
from services.ai_briefing_service import generate_weekly_digest

router = APIRouter()


@router.get("/")
@router.get("")
async def get_weekly_digest(req: Request):
    """
    REQ-006: GET /api/v1/digest — AI-generated weekly relationship summary.
    Entirely server-side. Frontend receives only the text.
    """
    db = getattr(req.app.state, "supabase", None)
    if not db:
        raise HTTPException(status_code=503, detail="Database not available")

    # Fetch last 7 days of calls
    seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    try:
        response = db.table("call_records") \
            .select("contact_name, executive_brief") \
            .gte("timestamp", seven_days_ago) \
            .order("timestamp", desc=True) \
            .execute()

        summaries = [
            {"contact_name": r.get("contact_name"), "summary": (r.get("executive_brief") or {}).get("summary")}
            for r in response.data
        ]

        digest_text = generate_weekly_digest(summaries)
        return {"status": "success", "digest": digest_text, "calls_analyzed": len(summaries)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
