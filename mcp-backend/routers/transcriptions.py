"""
Whisper v1-Compatible Transcription Router
Mirrors the OpenAI /v1/audio/transcriptions API surface.

POST /v1/audio/transcriptions
  Authorization: Bearer hzn_<key>
  Content-Type: multipart/form-data
  Body:
    file        — audio file (.m4a, .mp3, .wav, .ogg, etc.)
    model       — "whisper-horizon" or "whisper-1" (required for protocol parity)
    language    — ISO 639-1 code, default "en"
    response_format — "json" | "verbose_json" | "text"  (default: verbose_json)
    prompt      — optional context hint passed to Whisper
    temperature — float 0-1, default 0
    # Horizon-specific extensions:
    contact_name  — caller name
    duration      — call duration string
    call_timestamp — ISO timestamp of the call
"""
import logging
import time
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import PlainTextResponse

from core.api_key_auth import verify_api_key
from services.audio_processing_service import cleanup_processed_audio, process_audio_ingest

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Transcription helper ───────────────────────────────────────────────────────
def _run_transcription(
    wav_path: str,
    language: str = "en",
    prompt: str = "",
    temperature: float = 0.0,
) -> tuple[str, list, str, float]:
    """
    Extended transcription returning (text, segments, language, duration).
    Uses the singleton WhisperModel from TranscriptionManager.
    Defined at module level so it's available before the route handler.
    """
    from services.transcription_service import TranscriptionManager

    model = TranscriptionManager().get_model()

    kwargs: dict = dict(beam_size=5, language=language or None, temperature=temperature)
    if prompt:
        kwargs["initial_prompt"] = prompt

    seg_gen, info = model.transcribe(wav_path, **kwargs)

    segments = list(seg_gen)
    text_parts = [seg.text.strip() for seg in segments]
    
    segments_list = [
        {
            "id": i,
            "seek": getattr(s, "seek", 0),
            "start": s.start,
            "end": s.end,
            "text": s.text,
            "tokens": getattr(s, "tokens", []),
            "temperature": getattr(s, "temperature", 0.0),
            "avg_logprob": getattr(s, "avg_logprob", 0.0),
            "compression_ratio": getattr(s, "compression_ratio", 0.0),
            "no_speech_prob": getattr(s, "no_speech_prob", 0.0),
        }
        for i, s in enumerate(segments)
    ]

    full_text = " ".join(text_parts)
    return full_text, segments_list, info.language, info.duration


# ── Routes ─────────────────────────────────────────────────────────────────────
@router.post("/transcriptions")
@router.post("/audio/transcriptions") # Fallback for redundant clients
async def create_transcription(
    request: Request,
    background_tasks: BackgroundTasks,
    # ── Required (Whisper v1 parity) ──────────────────────────────
    file: UploadFile = File(..., description="Audio file to transcribe"),
    model: str = Form("whisper-horizon", description="Model identifier"),
    # ── Optional Whisper v1 fields ────────────────────────────────
    language: str = Form("en"),
    response_format: str = Form("verbose_json"),
    prompt: str = Form(""),
    temperature: float = Form(0.0),
    timestamp_granularities: str = Form("segment"),  # "word" | "segment"
    # ── Horizon extensions ────────────────────────────────────────
    contact_name: str = Form("Unknown"),
    phone_number: str = Form(""),
    duration: str = Form(""),
    call_timestamp: Optional[str] = Form(None),
    # ── Auth ──────────────────────────────────────────────────────
    _key: str = Depends(verify_api_key),
):
    """
    Whisper v1 compatible transcription endpoint.
    Accepts audio, runs faster-whisper, returns transcription in OpenAI-compatible format.
    Also stores the record in Supabase if DB is available.
    """
    # ── Validate model field (protocol parity) ────────────────────
    accepted_models = {"whisper-horizon", "whisper-1", "whisper-base", "whisper-small"}
    if model not in accepted_models:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown model '{model}'. Use 'whisper-horizon' or 'whisper-1'.",
        )

    ingest_start = time.perf_counter()
    requested_path = request.url.path
    logger.info(
        f"[TRANSCRIBE] Received: path={requested_path} file={file.filename!r} "
        f"model={model} lang={language} fmt={response_format}"
    )

    # ── Audio → WAV ───────────────────────────────────────────────
    wav_path: Optional[str] = None
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")
        logger.info(f"[TRANSCRIBE] Received {len(content):,} bytes from client.")
        wav_path = process_audio_ingest(content, file.filename or "audio.m4a")
        logger.info(f"[TRANSCRIBE] Normalized to WAV: {wav_path}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[TRANSCRIBE] Audio normalization failed: {e}", exc_info=True)
        raise HTTPException(status_code=422, detail=f"Audio processing failed: {str(e)}")

    # ── Transcription ─────────────────────────────────────────────
    transcript_text: str = ""
    segments: list = []
    detected_language: str = language
    audio_duration: float = 0.0
    try:
        transcript_text, segments, detected_language, audio_duration = _run_transcription(
            wav_path, language=language, prompt=prompt, temperature=temperature
        )
        logger.info(
            f"[TRANSCRIBE] Complete. lang={detected_language} "
            f"duration={audio_duration:.1f}s chars={len(transcript_text)}"
        )
    except Exception as e:
        logger.error(f"[TRANSCRIBE] Transcription engine failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
    finally:
        # Always schedule cleanup of the temp WAV (runs after response is sent)
        if wav_path:
            background_tasks.add_task(cleanup_processed_audio, wav_path)

    elapsed = time.perf_counter() - ingest_start
    logger.info(f"[TRANSCRIBE] Total pipeline time: {elapsed:.2f}s")

    # ── Persist to DB (non-blocking background task) ──────────────
    db = getattr(request.app.state, "supabase", None)
    if db:
        background_tasks.add_task(
            _persist_to_db,
            db=db,
            contact_name=contact_name,
            phone_number=phone_number,
            duration=duration,
            call_timestamp=call_timestamp,
            transcript_text=transcript_text,
        )

    # ── Build response to match Whisper v1 format ─────────────────
    if response_format == "text":
        return PlainTextResponse(content=transcript_text)

    if response_format == "json":
        return {"text": transcript_text}

    # Default: verbose_json — adds horizon_meta extension
    return {
        "task": "transcribe",
        "language": detected_language,
        "duration": round(audio_duration, 2),
        "text": transcript_text,
        "segments": segments,
        "horizon_meta": {
            "contact_name": contact_name,
            "phone_number": phone_number,
            "call_duration": duration,
            "call_timestamp": call_timestamp or datetime.now(timezone.utc).isoformat(),
            "model_used": model,
            "processing_time_s": round(elapsed, 3),
        },
    }


# ── Background DB persist ──────────────────────────────────────────────────────
async def _persist_to_db(
    db,
    contact_name: str,
    phone_number: str,
    duration: str,
    call_timestamp: Optional[str],
    transcript_text: str,
) -> None:
    """Background task: store the call record in Supabase."""
    try:
        # 1. Lookup contact if possible to link via UUID
        contact_id = None
        if phone_number or contact_name:
            try:
                # Try phone first (normalized)
                if phone_number:
                    clean_phone = "".join(filter(str.isdigit, phone_number))
                    if len(clean_phone) >= 10:
                        res = db.table("contacts").select("id").ilike("phone", f"%{clean_phone[-10:]}%").limit(1).execute()
                        if res.data:
                            contact_id = res.data[0]["id"]
                
                # Try name if phone failed
                if not contact_id and contact_name and contact_name != "Unknown":
                    res = db.table("contacts").select("id").ilike("full_name", f"%{contact_name}%").limit(1).execute()
                    if res.data:
                        contact_id = res.data[0]["id"]
            except Exception as e:
                logger.warning(f"[DB] Contact lookup failed (non-critical): {e}")

        # 2. Generate AI Brief (REQ-035)
        # Only if there's enough transcript to analyze
        executive_brief = None
        sentiment = "Neutral"
        tags = []
        if len(transcript_text) > 50:
            try:
                from services.ai_briefing_service import generate_call_brief
                brief = generate_call_brief(transcript_text, contact_name)
                executive_brief = brief
                sentiment = brief.get("sentiment", "Neutral")
                tags = brief.get("tags", [])
                logger.info(f"[AI] Successfully generated brief for {contact_name!r}")
            except Exception as ai_err:
                logger.warning(f"[AI] Brief generation failed: {ai_err}")

        # 3. Build record
        record = {
            "contact_name": contact_name,
            "phone_number": phone_number,
            "duration": duration,
            "raw_transcript": transcript_text,
            "transcript": transcript_text,
            "executive_brief": executive_brief,
            "sentiment": sentiment,
            "tags": tags,
            "status": "completed",
            "timestamp": call_timestamp or datetime.now(timezone.utc).isoformat(),
            "contact_id": contact_id,  # Linked UUID if found
        }
        
        # 4. Insert
        db.table("call_records").insert(record).execute()
        logger.info(
            f"[DB] Successfully persisted call record for {contact_name!r}. "
            f"Linked to contact: {bool(contact_id)}"
        )
    except Exception as e:
        error_msg = str(e)
        if "PGRST204" in error_msg or "not found" in error_msg.lower():
            logger.error(
                f"[DB] CRITICAL: Table 'call_records' not found in public schema. "
                f"Check RLS policies or API key permissions. Error: {error_msg}"
            )
        else:
            logger.error(f"[DB] Persist failed: {error_msg}", exc_info=True)
