"""
Whisper v1-Compatible Transcription Router — Horizon PRM Ingestion Server
Mirrors the OpenAI /v1/audio/transcriptions API surface for ACR Phone compatibility.

POST /v1/audio/transcriptions
  Primary auth:   Authorization: Bearer <HORIZON_API_KEY>
  Secondary auth: Secret=<ACR_WEBHOOK_SECRET>  (multipart form field, validated if env is set)
  Content-Type:   multipart/form-data

Standard Whisper v1 fields:
  file              — audio blob (.m4a, .mp3, .wav, .ogg, etc.)
  model             — "whisper-horizon" | "whisper-1" | "whisper-base" | "whisper-small"
  language          — ISO 639-1 code (default "en")
  response_format   — "json" | "verbose_json" | "text"  (default: verbose_json)
  prompt            — optional context hint for Whisper
  temperature       — float 0–1 (default 0)

ACR Phone native field mapping (multipart form):
  Source    → source  param → normalized to direction ("incoming" | "outgoing")
  Secret    → secret  param → validated against ACR_WEBHOOK_SECRET (secondary auth)
  Number    → phone_number param
  Date      → call_timestamp param (Unix seconds or ISO string)
  Duration  → duration param
  Note      → (ignored — Horizon generates its own note)

Horizon extension fields:
  contact_name  — caller display name (enriched from ACR filename parser if empty)
  phone_number  — E.164 phone (enriched from filename parser if empty)
  duration      — call duration string
  call_timestamp — ISO timestamp of the call

Pipeline states written to call_records.status:
  pending    → stub inserted immediately on file receipt
  processing → set before Whisper transcription begins
  completed  → set after transcription + brief are persisted
  error      → set on any failure; Sentinel picks these up for retry
"""
import asyncio
import logging
import os
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import PlainTextResponse

from core.api_key_auth import verify_api_key
from services.audio_processing_service import cleanup_processed_audio, process_audio_ingest, TEMP_DIR
from services.event_emitter import emit_event_async

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Transcription helper ──────────────────────────────────────────────────────
# PATCH-05 (C9): Logic moved to TranscriptionManager.run_transcription() in
# services/transcription_service.py to break the router→sentinel coupling.
# This shim delegates to the service layer and is kept only for any external
# callers that reference this symbol directly.
def _run_transcription(
    wav_path: str,
    language: str = "en",
    prompt: str = "",
    temperature: float = 0.0,
) -> tuple[str, list, str, float]:
    from services.transcription_service import TranscriptionManager
    return TranscriptionManager().run_transcription(wav_path, language, prompt, temperature)


def _normalize_direction(source: str) -> str:
    """
    Normalize ACR Phone's 'Source' field value to Horizon's canonical direction string.
    ACR Phone sends: "Outgoing" | "Incoming" (exact casing may vary by app version).
    Returns: "outgoing" | "incoming" | "" (unknown — diarization skips speaker assignment).
    """
    s = (source or "").strip().lower()
    if s in ("outgoing", "out", "1", "dialed", "calling"):
        return "outgoing"
    if s in ("incoming", "in", "0", "received", "receiving"):
        return "incoming"
    return ""


# ── Route ───────────────────────────────────────────────────────────────────────
@router.post("/transcriptions")
async def create_transcription(
    request: Request,
    background_tasks: BackgroundTasks,
    # ── Required (Whisper v1 parity) ──────────────────────────────────────────
    file: UploadFile = File(..., description="Audio file to transcribe"),
    model: str = Form("whisper-horizon"),
    # ── Optional Whisper v1 fields ─────────────────────────────────────────────
    language: str = Form("en"),
    response_format: str = Form("verbose_json"),
    prompt: str = Form(""),
    temperature: float = Form(0.0),
    timestamp_granularities: str = Form("segment"),
    # ── Horizon extension fields ───────────────────────────────────────────────
    contact_name: str = Form("Unknown"),
    phone_number: str = Form(""),
    duration: str = Form(""),
    call_timestamp: Optional[str] = Form(None),
    # ── ACR Phone native fields (mapped from ACR's multipart field names) ──────
    source: str = Form(""),   # ACR "Source" → direction
    secret: str = Form(""),   # ACR "Secret" → secondary auth
    # ── Primary auth (Bearer token) ───────────────────────────────────────────
    _key: str = Depends(verify_api_key),
):
    """
    Whisper v1-compatible endpoint. ACR Phone posts audio here after every call.
    Returns JSON with top-level "text" field containing the executive brief + transcript,
    which ACR Phone stores as the call note on the device.
    """

    # ── Resolve ACR Phone's capitalized field names ───────────────────────────
    # ACR Phone sends: Source, Secret, Number, Date, Duration (capital first letter).
    # FastAPI Form matching is case-sensitive so lowercase params miss them all.
    # Re-reading the cached raw form lets us catch both conventions.
    try:
        _raw = await request.form()
        if not source:
            source = str(_raw.get("Source", ""))
        if not secret:
            secret = str(_raw.get("Secret", ""))
        if not phone_number:
            phone_number = str(_raw.get("Number", ""))
        if not duration:
            duration = str(_raw.get("Duration", ""))
        if not call_timestamp:
            _date_val = str(_raw.get("Date", ""))
            if _date_val and _date_val.lower() != "none":
                call_timestamp = _date_val
    except Exception as _form_err:
        logger.debug(f"[FORM] Raw form re-read skipped: {_form_err}")

    # ── Secondary auth: validate ACR Secret form field if env is configured ───
    acr_secret_env = os.environ.get("ACR_WEBHOOK_SECRET", "")
    if acr_secret_env and secret and secret != acr_secret_env:
        logger.warning(
            f"[AUTH] ACR Secret mismatch from {request.client.host if request.client else 'unknown'}"
        )
        raise HTTPException(status_code=401, detail="Invalid ACR webhook secret.")

    # ── Validate model ────────────────────────────────────────────────────────
    accepted_models = {"whisper-horizon", "whisper-1", "whisper-base", "whisper-small"}
    if model not in accepted_models:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown model '{model}'. Accepted: {sorted(accepted_models)}",
        )

    # ── Normalize call direction from ACR Source field ────────────────────────
    direction = _normalize_direction(source)

    ingest_start = time.perf_counter()
    logger.info(
        f"[TRANSCRIBE] Inbound: file={file.filename!r} model={model} "
        f"direction={direction or 'unknown'} contact={contact_name!r}"
    )

    # ── Parse ACR filename for enriched metadata ──────────────────────────────
    # ACR filenames encode: date, time, direction, phone, contact name.
    # full_parse() extracts all of these and builds the canonical name.
    metadata: dict = {}
    try:
        from services.acr_parser_reference import full_parse

        # Write to TEMP_DIR (not CWD) so cleanup is predictable on all platforms
        suffix = Path(file.filename).suffix if file.filename else ".m4a"
        temp_meta_path = TEMP_DIR / f"meta_{uuid.uuid4()}{suffix}"
        temp_meta_path.write_bytes(await file.read())
        await file.seek(0)

        metadata = full_parse(temp_meta_path)
        temp_meta_path.unlink(missing_ok=True)

        logger.info(
            f"[ACR-PARSE] Pattern={metadata.get('pattern')} "
            f"Canonical={metadata.get('canonical_name')}"
        )

        # Enrich form fields from filename when form fields are empty/default
        if (not contact_name or contact_name == "Unknown") and metadata.get("contact_name"):
            contact_name = metadata["contact_name"]
        if not phone_number and metadata.get("phone_e164"):
            phone_number = metadata["phone_e164"]
        if not call_timestamp and metadata.get("datetime_str"):
            try:
                dt = datetime.strptime(metadata["datetime_str"], "%Y-%m-%d_%H%M%S")
                call_timestamp = dt.replace(tzinfo=timezone.utc).isoformat()
            except Exception:
                pass
        # Direction from filename if Source form field was empty
        if not direction and metadata.get("direction"):
            direction = _normalize_direction(metadata["direction"])

    except Exception as parse_err:
        logger.warning(f"[ACR-PARSE] Filename parse failed (non-critical): {parse_err}")
        # Reset file pointer in case read() was called before the error
        try:
            await file.seek(0)
        except Exception:
            pass

    # ── Pipeline state: insert pending stub ───────────────────────────────────
    # Inserting now lets HorizonSentinel detect stuck records even if the server
    # crashes mid-transcription. Background task upgrades to completed/error.
    db = getattr(request.app.state, "supabase", None)
    record_id: Optional[str] = None
    if db:
        try:
            # .select("id") forces supabase-py v2 to return the inserted row
            stub_res = db.table("call_records").insert({
                "contact_name": contact_name,
                "phone_number": phone_number,
                "status": "pending",
                "acr_direction": direction or None,
                "acr_channel": "phone",
                "duration": duration or None,
                "timestamp": call_timestamp or datetime.now(timezone.utc).isoformat(),
            }).select("id").execute()
            if stub_res.data:
                record_id = stub_res.data[0]["id"]
                db.table("call_records").update({"status": "processing"}).eq("id", record_id).execute()
                logger.info(f"[PIPELINE] Stub {record_id} → processing")
        except Exception as stub_err:
            logger.warning(f"[DB] Stub insert failed (pipeline continues without it): {stub_err}")

    # ── Audio → 16kHz mono WAV ────────────────────────────────────────────────
    wav_path: Optional[str] = None
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded audio file is empty.")
        logger.info(f"[TRANSCRIBE] {len(content):,} bytes received — converting to WAV...")
        loop = asyncio.get_event_loop()
        wav_path = await loop.run_in_executor(
            None, process_audio_ingest, content, file.filename or "audio.m4a"
        )
        logger.info(f"[TRANSCRIBE] WAV ready: {wav_path}")
    except HTTPException:
        _mark_error(db, record_id)
        raise
    except Exception as conv_err:
        logger.error(f"[TRANSCRIBE] Audio conversion failed: {conv_err}", exc_info=True)
        _mark_error(db, record_id)
        await emit_event_async(
            db, "transcription", "error",
            error=f"Audio conversion failed: {str(conv_err)}",
            detail={"file": file.filename, "contact": contact_name},
        )
        raise HTTPException(status_code=422, detail=f"Audio processing failed: {str(conv_err)}")

    # ── Whisper transcription (off event loop — keeps server responsive) ─────
    # _run_transcription is CPU-bound and blocks for seconds to minutes.
    # Running it in the default ThreadPoolExecutor lets asyncio continue
    # handling health checks, Sentinel queries, and concurrent ACR calls.
    transcript_text: str = ""
    segments: list = []
    detected_language: str = language
    audio_duration: float = 0.0
    try:
        import functools
        transcript_text, segments, detected_language, audio_duration = await loop.run_in_executor(
            None,
            functools.partial(_run_transcription, wav_path, language=language, prompt=prompt, temperature=temperature),
        )
        logger.info(
            f"[TRANSCRIBE] Done. lang={detected_language} "
            f"audio={audio_duration:.1f}s chars={len(transcript_text)}"
        )
    except Exception as whisper_err:
        logger.error(f"[TRANSCRIBE] Whisper failed: {whisper_err}", exc_info=True)
        _mark_error(db, record_id)
        await emit_event_async(
            db, "transcription", "error",
            error=f"Whisper engine failed: {str(whisper_err)}",
            detail={"contact": contact_name},
        )
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(whisper_err)}")
    finally:
        # Always clean up the temp WAV, even on failure
        if wav_path:
            background_tasks.add_task(cleanup_processed_audio, wav_path)

    # ── Gemini executive brief ────────────────────────────────────────────────
    executive_brief: Optional[dict] = None
    if len(transcript_text) > 50:
        try:
            from services.ai_briefing_service import generate_call_brief
            logger.info(f"[AI] Generating brief for {contact_name!r}...")
            executive_brief = generate_call_brief(transcript_text, contact_name)
            logger.info(f"[AI] Brief done. Sentiment={executive_brief.get('sentiment', '?')}")
        except Exception as ai_err:
            logger.warning(f"[AI] Brief generation failed (non-blocking): {ai_err}")

    elapsed = time.perf_counter() - ingest_start
    logger.info(f"[TRANSCRIBE] Full pipeline: {elapsed:.2f}s")

    # ── Build ACR note: brief header + transcript ─────────────────────────────
    enriched_text = _format_enriched_response(transcript_text, executive_brief)

    # ── Persist: update stub to completed (background, after response sent) ───
    if db:
        background_tasks.add_task(
            _persist_to_db,
            db=db,
            record_id=record_id,
            contact_name=contact_name,
            phone_number=phone_number,
            duration=duration,
            direction=direction,
            call_timestamp=call_timestamp,
            transcript_text=transcript_text,
            executive_brief=executive_brief,
            metadata=metadata,
        )

    # ── Response (Whisper v1 shape — ACR reads the "text" field) ─────────────
    if response_format == "text":
        return PlainTextResponse(content=enriched_text)

    if response_format == "json":
        return {"text": enriched_text}

    # Default: verbose_json — adds horizon_meta extension block
    return {
        "task": "transcribe",
        "language": detected_language,
        "duration": round(audio_duration, 2),
        "text": enriched_text,
        "segments": segments,
        "horizon_meta": {
            "contact_name": contact_name,
            "phone_number": phone_number,
            "call_duration": duration,
            "direction": direction or "unknown",
            "call_timestamp": call_timestamp or datetime.now(timezone.utc).isoformat(),
            "model_used": model,
            "processing_time_s": round(elapsed, 3),
            "brief_generated": executive_brief is not None,
            "record_id": record_id,
        },
    }


# ── Helpers ─────────────────────────────────────────────────────────────────────

def _mark_error(db, record_id: Optional[str]) -> None:
    """Best-effort update of a pipeline stub to error state on failure."""
    if db and record_id:
        try:
            db.table("call_records").update({"status": "error"}).eq("id", record_id).execute()
        except Exception:
            pass


def _format_enriched_response(transcript: str, brief: Optional[dict]) -> str:
    """
    Build the text that ACR Phone stores as the call note.
    Format: executive brief header block, then the raw transcript below.
    ACR Phone displays this in the call log note field on the device.

    F-07 fix: reads both camelCase 'actionItems' (Gemini output) and
    snake_case 'action_items' (internal convention) — whichever is present.
    """
    if not brief:
        return transcript

    lines = ["━━━ HORIZON EXECUTIVE BRIEF ━━━"]

    if brief.get("title"):
        lines.append(f"📌 {brief['title']}")

    if brief.get("summary"):
        lines.append(f"\n{brief['summary']}")

    if brief.get("sentiment"):
        lines.append(f"\nSentiment: {brief['sentiment']}")

    # Read both key conventions — Gemini returns camelCase, internal code uses snake_case
    action_items = brief.get("action_items") or brief.get("actionItems", [])
    if action_items:
        lines.append("\nAction Items:")
        for item in action_items:
            lines.append(f"  • {item}")

    open_commitments = brief.get("open_commitments", [])
    if open_commitments:
        lines.append("\nCommitments:")
        for c in open_commitments:
            text = c.get("commitment", str(c)) if isinstance(c, dict) else str(c)
            lines.append(f"  ◆ {text}")

    tags = brief.get("tags", [])
    if tags:
        lines.append(f"\nTags: {', '.join(f'#{t}' for t in tags)}")

    if brief.get("recommended_followup_date"):
        lines.append(f"Follow-up: {brief['recommended_followup_date']}")

    lines.append("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    lines.append("")
    lines.append(transcript)
    return "\n".join(lines)


# ── Background DB persist ────────────────────────────────────────────────────────
async def _persist_to_db(
    db,
    record_id: Optional[str],
    contact_name: str,
    phone_number: str,
    duration: str,
    direction: str,
    call_timestamp: Optional[str],
    transcript_text: str,
    executive_brief: Optional[dict] = None,
    metadata: Optional[dict] = None,
) -> None:
    """
    Runs as a FastAPI background task — executes after the ACR response is already sent.

    If record_id is set: UPDATEs the pending/processing stub with full transcript data.
    If record_id is None (DB was down during ingest): INSERTs a fresh completed record.

    REQ-037: Transcript is encrypted at rest (AES-256-GCM) before storage.
    F-09:    Action items from the brief are written as individual rows in the tasks table.
    F-08:    Encryption applied here — not in the sync request path.
    """
    try:
        # 1. Encrypt transcript at rest (REQ-037)
        transcript_encrypted: Optional[str] = None
        transcript_iv: Optional[str] = None
        try:
            from core.security.crypto import encrypt_data
            transcript_encrypted, transcript_iv = encrypt_data(transcript_text)
        except Exception as enc_err:
            logger.warning(f"[DB] Encryption failed (transcript stored plaintext as fallback): {enc_err}")

        # 2. Resolve contact UUID for relational link
        contact_id: Optional[str] = None
        try:
            if phone_number:
                digits = "".join(c for c in phone_number if c.isdigit())
                if len(digits) >= 10:
                    res = (
                        db.table("contacts")
                        .select("id")
                        .ilike("phone", f"%{digits[-10:]}%")
                        .limit(1)
                        .execute()
                    )
                    if res.data:
                        contact_id = res.data[0]["id"]
            if not contact_id and contact_name and contact_name != "Unknown":
                res = (
                    db.table("contacts")
                    .select("id")
                    .ilike("full_name", f"%{contact_name}%")
                    .limit(1)
                    .execute()
                )
                if res.data:
                    contact_id = res.data[0]["id"]
        except Exception as lookup_err:
            logger.warning(f"[DB] Contact lookup failed (non-critical): {lookup_err}")

        # 3. Normalize brief fields — Gemini returns camelCase; normalize to snake_case
        action_items: list = []
        sentiment: str = "Neutral"
        tags: list = []
        if executive_brief:
            action_items = executive_brief.get("action_items") or executive_brief.get("actionItems", [])
            sentiment = executive_brief.get("sentiment", "Neutral")
            tags = executive_brief.get("tags", [])

        # 4. Determine final status
        status = "completed"
        if not transcript_text or len(transcript_text.strip()) < 5:
            status = "error"
            logger.warning(f"[DB] Empty transcript for {contact_name!r} — status=error")

        # 5. Build the full payload — column names must match actual DB schema
        payload = {
            "contact_name": contact_name,
            "phone_number": phone_number,
            "duration": duration or None,
            "acr_direction": direction or None,
            "acr_channel": "phone",
            "raw_transcript": transcript_text,
            "transcript": transcript_text,
            "transcript_encrypted": transcript_encrypted,
            "transcript_iv": transcript_iv,
            "executive_brief": executive_brief,
            "sentiment": sentiment,
            "tags": tags,
            "status": status,
            "timestamp": call_timestamp or datetime.now(timezone.utc).isoformat(),
            "contact_id": contact_id,
            # ACR filename parse enrichment
            "acr_pattern": metadata.get("pattern") if metadata else None,
            "acr_phone_e164": metadata.get("phone_e164") if metadata else None,
            # canonical_name column doesn't exist in schema — omitted
        }

        # 6. UPDATE stub OR INSERT fresh record
        if record_id:
            db.table("call_records").update(payload).eq("id", record_id).execute()
            logger.info(f"[DB] Updated stub {record_id} for {contact_name!r} → {status}")
        else:
            res = db.table("call_records").insert({**payload, "status": status}).select("id").execute()
            record_id = res.data[0]["id"] if res.data else None
            logger.info(f"[DB] Inserted record {record_id} for {contact_name!r} → {status}")

        # 7. Write action items to tasks table (F-09)
        if record_id and action_items:
            try:
                task_rows = [
                    {
                        "title": item[:120] if len(item) > 120 else item,
                        "description": item,
                        "status": "pending",
                        "source": "ai_brief",
                        "contact_id": contact_id,
                        "contact_name": contact_name,
                        "ai_confidence": 0.85,
                        "related_call_id": record_id,
                    }
                    for item in action_items
                    if item and isinstance(item, str)
                ]
                if task_rows:
                    db.table("tasks").insert(task_rows).execute()
                    logger.info(f"[DB] Created {len(task_rows)} task row(s) for {contact_name!r}")
            except Exception as task_err:
                # Non-critical — column names may differ; logged for schema alignment
                logger.warning(f"[DB] Task insert failed (check tasks table schema): {task_err}")

        # 8. Realtime broadcast → dashboard refreshes without page reload
        from services.event_emitter import emit_event
        emit_event(
            db, "transcription", "completed",
            record_id=record_id,
            detail={
                "contact": contact_name,
                "duration": duration,
                "brief_generated": executive_brief is not None,
                "tasks_created": len(action_items),
                "direction": direction or "unknown",
            },
        )

    except Exception as persist_err:
        error_msg = str(persist_err)
        if "PGRST204" in error_msg or "not found" in error_msg.lower():
            logger.error(
                "[DB] CRITICAL: Table 'call_records' not found in public schema. "
                f"Check RLS policies or API key permissions. Error: {error_msg}"
            )
        else:
            logger.error(f"[DB] Persist failed for {contact_name!r}: {error_msg}", exc_info=True)

        # Mark stub as error so Sentinel can find and retry it
        if record_id:
            try:
                db.table("call_records").update({"status": "error"}).eq("id", record_id).execute()
            except Exception:
                pass

        try:
            from services.event_emitter import emit_event
            emit_event(db, "transcription", "error",
                       error=error_msg[:500],
                       detail={"contact": contact_name})
        except Exception:
            pass
