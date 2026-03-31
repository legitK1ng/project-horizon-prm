from fastapi import APIRouter, Request, HTTPException
from typing import Dict, Any

router = APIRouter()

@router.get("/")
@router.get("")
async def get_all_dashboard_data(req: Request):
    """
    Unified endpoint for initial React dashboard load.
    Aggregates contacts and call_records.
    """
    db = getattr(req.app.state, "supabase", None)
    if not db:
        raise HTTPException(status_code=503, detail="Database not available")

    try:
        # Fetch call records
        calls_response = db.table("call_records") \
            .select("*") \
            .order("timestamp", desc=True) \
            .limit(100) \
            .execute()
        
        # Fetch contacts
        contacts_response = db.table("contacts") \
            .select("*") \
            .order("first_name", desc=False) \
            .execute()

        return {
            "status": "success",
            "logs": calls_response.data,
            "contacts": contacts_response.data,
            "count_calls": len(calls_response.data),
            "count_contacts": len(contacts_response.data)
        }
    except Exception as e:
        print(f"[DATA] Error fetching dashboard data: {e}")
        raise HTTPException(status_code=500, detail=str(e))
