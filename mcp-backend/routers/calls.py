import os
import sys
import json
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Request, HTTPException, Depends, UploadFile, File, Form, BackgroundTasks
from pydantic import BaseModel

from services.ai_briefing_service import generate_call_brief
from services.audio_processing_service import process_audio_ingest, cleanup_processed_audio
from services.transcription_service import transcribe_audio
from core.security.crypto import encrypt_data
from core.auth import verify_acr_secret

logger = logging.getLogger(__name__)
router = APIRouter()

class CallIngestRequest(BaseModel):
    contact_name: str = "Unknown"
    phone_number: str = ""
    note: str = "" # transcript (if provided as text)
    duration: str | int = ""
    timestamp: str | None = None
    external_id: str | None = None

@router.post("/")
@router.post("")
async def ingest_call(
    req: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(None),
    contact_name: str = Form("Unknown"),
    phone_number: str = Form(""),
    duration: str = Form(""),
    timestamp: str = Form(None),
    note: str = Form(""), # This is used if the app sends pre-transcribed text
    _auth: bool = Depends(verify_acr_secret)
):
    """
    REQ-011/014/016: POST /api/v1/calls — Securely ingest a call (audio or text) and analyze.
    REQ-018: Secret Handshake enforced via Depends(verify_acr_secret).
    REQ-024/025: Temporary storage and cleanup of audio files.
    REQ-151: End-to-end transcription pipeline.
    """
    db = getattr(req.app.state, "supabase", None)
    if not db:
        raise HTTPException(status_code=503, detail="Database not available")

    # 1. Handle Audio Processing & Transcription
    transcript = note
    wav_path = None

    if file:
        logger.info(f"[INGEST] Receiving file: {file.filename}")
        try:
            # Save and normalize audio (FFmpeg)
            content = await file.read()
            wav_path = process_audio_ingest(content, file.filename)
            logger.info(f"[INGEST] Audio converted to: {wav_path}")
            
            # REQ-151: Real Transcription
            if not transcript or transcript == "[AUDIO_ONLY_PENDING_TRANSCRIPTION]":
                logger.info("[INGEST] Starting transcription...")
                transcript = transcribe_audio(wav_path)
                logger.info(f"[INGEST] Transcription result: {transcript[:50]}...")
                
            # Schedule cleanup
            background_tasks.add_task(cleanup_processed_audio, wav_path)
        except Exception as e:
            logger.error(f"[INGEST] Audio processing or transcription failed: {e}")
            if not transcript:
                transcript = "[TRANSCRIPTION_ERROR]"

    if not transcript and not file:
        raise HTTPException(status_code=400, detail="No transcript or audio file provided.")

    # 2. Generate proactive AI brief (REQ-035)
    brief = {}
    try:
        # Only attempt AI if we have actual text content
        if transcript and not transcript.startswith("["):
            brief = generate_call_brief(transcript, contact_name)
        else:
            brief = {"summary": "Call ingested. Transcription in progress.", "actionItems": []}
    except Exception as e:
        logger.error(f"[AI] Briefing generation failed: {e}")
        brief = {"error": str(e), "summary": "Brief generation failed", "actionItems": []}

    # 3. Field-level encryption (REQ-039)
    transcript_encrypted = None
    transcript_iv = None
    
    try:
        if transcript:
            transcript_encrypted, transcript_iv = encrypt_data(transcript)
    except Exception as e:
        logger.error(f"[SECURITY] Encryption failed: {e}")

    record = {
        "contact_name": contact_name,
        "phone_number": phone_number,
        "duration": str(duration),
        "transcript_encrypted": transcript_encrypted,
        "transcript_iv": transcript_iv,
        "executive_brief": brief,
        "status": "COMPLETED",
        "sentiment": brief.get("sentiment", "Neutral"),
        "tags": brief.get("tags", []),
        "recommended_followup_date": brief.get("recommended_followup_date"),
        "draft_followup_message": brief.get("draft_followup_message"),
        "open_commitments": brief.get("open_commitments", []),
        "timestamp": timestamp or datetime.now(timezone.utc).isoformat(),
    }

    try:
        response = db.table("call_records").insert(record).execute()
        return {
            "status": "success",
            "message": "Call ingested and processed",
            "call_id": response.data[0]["id"],
            "brief": brief
        }
    except Exception as e:
        logger.error(f"[DB] Insert failed: {e}")
        raise HTTPException(status_code=500, detail=f"DB insert failed: {str(e)}")


@router.get("/")
@router.get("")
async def list_calls(req: Request, limit: int = 100, offset: int = 0):
    """REQ-016: GET /api/v1/calls — List call records with decrypted transcripts."""
    db = getattr(req.app.state, "supabase", None)
    if not db:
        raise HTTPException(status_code=503, detail="Database not available")

    try:
        from core.security.crypto import decrypt_data
        response = db.table("call_records").select("*").order("timestamp", desc=True).range(offset, offset + limit - 1).execute()

        records = []
        for record in response.data:
            # Decrypt transcript at read time
            enc = record.get("transcript_encrypted") or ""
            iv = record.get("transcript_iv") or ""
            if enc and iv:
                record["transcript"] = decrypt_data(enc, iv)
            else:
                record["transcript"] = record.get("transcript") or record.get("note") or ""
            records.append(record)

        return {
            "status": "success",
            "data": records,
            "count": len(records)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

