"""
POST /api/v1/batch-ingest       — trigger a scan of a source directory
GET  /api/v1/batch-ingest/status — query scan progress / recent results
"""
import logging
import os
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()

# In-process state for the last run (single-worker; replace with Redis for multi-worker)
_last_run: dict = {}


class BatchIngestRequest(BaseModel):
    source_path: str | None = None    # override; defaults to AUDIO_SOURCE_PATH env var
    min_size_bytes: int = 4096


@router.post("")
@router.post("/")
async def trigger_batch_ingest(body: BatchIngestRequest, req: Request):
    """
    Walk source_path for audio files, parse ACR filenames, upsert to
    call_recordings. Skips duplicates (MD5) and very small files.
    Returns counts synchronously — runs in-request for simplicity.
    For large archives (>500 files) consider calling via background task.
    """
    db = getattr(req.app.state, "supabase", None)
    if not db:
        raise HTTPException(status_code=503, detail="Database not available")

    source = body.source_path or os.environ.get("AUDIO_SOURCE_PATH", "")
    if not source:
        raise HTTPException(
            status_code=422,
            detail="source_path required (or set AUDIO_SOURCE_PATH env var)",
        )

    try:
        from services.batch_ingest_service import run_batch_ingest
        stats = run_batch_ingest(source, db, min_size_bytes=body.min_size_bytes)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"[BATCH ROUTER] Unhandled error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    result = {
        "status":             "complete",
        "source_path":        source,
        "ran_at":             datetime.now(timezone.utc).isoformat(),
        "scanned":            stats.scanned,
        "inserted":           stats.inserted,
        "skipped_duplicate":  stats.skipped_duplicate,
        "skipped_short":      stats.skipped_short,
        "unmatched":          stats.unmatched,
        "errors":             stats.errors,
        "error_details":      stats.error_details[:20],  # cap to avoid giant response
    }
    _last_run.update(result)
    return result


@router.get("/status")
async def batch_ingest_status():
    """Return stats from the most recent batch ingest run."""
    if not _last_run:
        return {"status": "no_run", "message": "No batch ingest has been triggered yet"}
    return _last_run
