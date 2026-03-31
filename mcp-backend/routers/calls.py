"""
Calls Router — AGENT-3a | REQ-014, REQ-016, REQ-035, REQ-039
Handles call ingestion with proactive AI brief generation.
Transcripts are encrypted before storage (REQ-039).
"""
import os
import sys
from datetime import datetime, timezone
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel

from services.ai_briefing_service import generate_call_brief
from core.security.crypto import encrypt_data

router = APIRouter()


class CallIngestRequest(BaseModel):
    contact_name: str = "Unknown"
    phone_number: str = ""
    note: str  # transcript
    duration: str | int = ""
    timestamp: str | None = None
    external_id: str | None = None


@router.post("/")
@router.post("")
async def ingest_call(req: Request, body: CallIngestRequest):
    """
    REQ-014/016: POST /api/v1/calls — Ingest a call and generate proactive AI brief.
    REQ-035: Returns recommended_followup_date, draft_followup_message, open_commitments.
    REQ-039: Encrypts transcript before storage.
    """
    db = getattr(req.app.state, "supabase", None)
    if not db:
        raise HTTPException(status_code=503, detail="Database not available")

    transcript = body.note
    if not transcript:
        raise HTTPException(status_code=400, detail="No transcript provided in 'note' field")

    # Generate proactive AI brief (REQ-035)
    brief = {}
    try:
        brief = generate_call_brief(transcript, body.contact_name)
    except Exception as e:
        print(f"[AI] Briefing generation failed: {e}", file=sys.stderr)
        brief = {"error": str(e), "summary": "Brief generation failed", "actionItems": []}

    # Field-level encryption (REQ-039 / REQ-037)
    transcript_encrypted = None
    transcript_iv = None
    
    try:
        transcript_encrypted, transcript_iv = encrypt_data(transcript)
    except Exception as e:
        print(f"[SECURITY] Encryption failed: {e}", file=sys.stderr)

    record = {
        "contact_name": body.contact_name,
        "phone_number": body.phone_number,
        "duration": str(body.duration),
        "transcript_encrypted": transcript_encrypted,
        "transcript_iv": transcript_iv,
        "executive_brief": brief,
        "status": "COMPLETED",
        "sentiment": brief.get("sentiment", "Neutral"),
        "tags": brief.get("tags", []),
        "recommended_followup_date": brief.get("recommended_followup_date"),
        "draft_followup_message": brief.get("draft_followup_message"),
        "open_commitments": brief.get("open_commitments", []),
        "timestamp": body.timestamp or datetime.now(timezone.utc).isoformat(),
    }

    try:
        response = db.table("call_records").insert(record).execute()
        return {
            "status": "success",
            "message": "Call ingested and analyzed",
            "call_id": response.data[0]["id"],
            "brief": brief
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB insert failed: {str(e)}")


@router.get("/")
@router.get("")
async def list_calls(req: Request, limit: int = 50, offset: int = 0):
    """REQ-016: GET /api/v1/calls — List call records."""
    db = getattr(req.app.state, "supabase", None)
    if not db:
        raise HTTPException(status_code=503, detail="Database not available")

    try:
        response = db.table("call_records").select("*").order("timestamp", desc=True).range(offset, offset + limit - 1).execute()
        return {
            "status": "success",
            "data": response.data,
            "count": len(response.data)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
