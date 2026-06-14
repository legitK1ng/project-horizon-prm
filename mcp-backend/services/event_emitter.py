"""
Event Emitter Service — Horizon PRM
Writes structured lifecycle events to the `pipeline_events` Supabase table.

The `pipeline_events` table has Supabase Realtime enabled, so any INSERT here
immediately broadcasts to all React clients subscribed to the channel.

Usage (fire-and-forget, never raises):
    from services.event_emitter import emit_event

    emit_event(db, "transcription", "completed", record_id=call_id,
               detail={"contact": "John Doe", "duration": "3:42"})

    emit_event(db, "enrichment", "error",
               error="Google People API rate-limited",
               detail={"phone": "+15551234567"})
"""
import logging
from datetime import datetime, timezone
from typing import Any, Literal, Optional

logger = logging.getLogger(__name__)

# ── Types ─────────────────────────────────────────────────────────────────────

EventSource = Literal[
    "transcription",   # /v1/audio/transcriptions and calls.py
    "batch_ingest",    # batch_ingest_service.py
    "enrichment",      # enrichment_service.py
    "sentinel",        # core/sentinel.py
    "digest",          # routers/digest.py
    "system",          # startup / lifespan
]

EventStatus = Literal[
    "started",
    "completed",
    "error",
    "warning",
    "info",
]


# ── Core emitter ──────────────────────────────────────────────────────────────

def emit_event(
    db: Any,
    source: EventSource,
    status: EventStatus,
    *,
    record_id: Optional[str] = None,
    error: Optional[str] = None,
    detail: Optional[dict] = None,
) -> bool:
    """
    Insert one row into `pipeline_events`. Never raises — all errors are
    logged as warnings so a broken event bus never kills the main pipeline.

    Args:
        db:        Supabase client (app.state.supabase).
        source:    Which subsystem is emitting (transcription, enrichment, …).
        status:    Lifecycle status of this event.
        record_id: Optional UUID of the related call_record or enrichment job.
        error:     Human-readable error string (only on status=error/warning).
        detail:    Arbitrary JSON metadata — keep it small (<1 KB).

    Returns:
        True if the insert succeeded, False otherwise.
    """
    if db is None:
        logger.debug("[EVENTS] No DB client — event not emitted.")
        return False

    # Map to actual pipeline_events schema:
    #   event_type  = source (transcription, sentinel, etc.)
    #   severity    = status (completed→info, error→error, warning→warning)
    #   reference_id = record_id (FK to call_records)
    #   message     = error string or auto-generated summary
    severity_map = {
        "completed": "info",
        "started":   "info",
        "info":      "info",
        "warning":   "warning",
        "error":     "error",
    }
    payload: dict = {
        "event_type":      status,                           # lifecycle stage
        "severity":        severity_map.get(status, "info"),
        "source":          source,
        "reference_type":  "call_record",
        "message":         error or f"{source} {status}",
        "detail":          detail or {},
    }
    if record_id:
        payload["reference_id"] = record_id

    try:
        db.table("pipeline_events").insert(payload).execute()
        logger.debug(f"[EVENTS] {source}:{status} ref={record_id or '-'}")
        return True
    except Exception as exc:
        logger.warning(f"[EVENTS] Emit failed (non-critical): {exc}")
        return False


# ── Async variant ─────────────────────────────────────────────────────────────

async def emit_event_async(
    db: Any,
    source: EventSource,
    status: EventStatus,
    *,
    record_id: Optional[str] = None,
    error: Optional[str] = None,
    detail: Optional[dict] = None,
) -> bool:
    """
    Async-compatible wrapper. The supabase-py client is synchronous so this
    just calls emit_event() — exists for convenience in async route handlers.
    """
    return emit_event(db, source, status,
                      record_id=record_id, error=error, detail=detail)
