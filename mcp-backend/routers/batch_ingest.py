"""
POST /api/v1/batch-ingest        — trigger ingestion from a source
GET  /api/v1/batch-ingest/status — query most recent run stats

Supported source types (pass in `source` field):
  'folder'  — scan a local directory (default when `url` not given)
  'wifi'    — pull recordings from ACR Phone WiFi Web Server (`url` required)
"""
import logging
import os
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter()

# In-process state for the last run (single-worker; replace with Redis for multi-worker)
_last_run: dict = {}


class BatchIngestRequest(BaseModel):
    # Source type selector
    source: str | None = Field(None, description="'wifi' | 'folder'. Defaults to 'folder'.")
    # WiFi source
    url: str | None = Field(None, description="ACR WiFi Web Server base URL (required when source='wifi')")
    # Folder source
    source_path: str | None = Field(None, description="Local folder path to scan")
    path: str | None = Field(None, description="Alias for source_path")
    min_size_bytes: int = Field(4096, description="Skip files smaller than this (bytes)")


@router.post("")
@router.post("/")
async def trigger_batch_ingest(body: BatchIngestRequest, req: Request):
    """
    Trigger a batch ingestion from the specified source.

    WiFi mode: connects to ACR Phone WiFi Web Server, downloads all recordings
    not already in the database, runs the full transcription pipeline on each,
    and stores results in both call_recordings (archive) and call_records (processed).

    Folder mode: walks a local directory, parses ACR filenames, upserts to
    call_recordings. Skips duplicates (MD5) and very small files.
    """
    db = getattr(req.app.state, "supabase", None)
    if not db:
        raise HTTPException(status_code=503, detail="Database not available")

    # Determine source type from body
    source_type = body.source
    if not source_type:
        source_type = "wifi" if body.url else "folder"

    # ── WiFi mode ──────────────────────────────────────────────────────────────
    if source_type == "wifi":
        if not body.url:
            raise HTTPException(
                status_code=422,
                detail="url is required when source='wifi' (e.g. 'http://192.168.x.x:8000')",
            )

        logger.info(f"[BATCH-WIFI] Starting WiFi ingest from {body.url}")
        try:
            from services.acr_wifi_service import wifi_batch_ingest
            import asyncio
            loop = asyncio.get_event_loop()
            stats = await loop.run_in_executor(None, lambda: wifi_batch_ingest(body.url, db))
        except ConnectionError as e:
            raise HTTPException(status_code=502, detail=str(e))
        except Exception as e:
            logger.error(f"[BATCH-WIFI] Unhandled error: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=str(e))

        result = {
            "status": "complete",
            "source": "wifi",
            "url": body.url,
            "ran_at": datetime.now(timezone.utc).isoformat(),
            # Keys the frontend expects
            "found": stats["found"],
            "downloaded": stats["downloaded"],
            "skipped": stats["skipped"],
            "transcribed": stats.get("transcribed", 0),
            "errors": stats["errors"],
            "error_details": stats["error_details"][:20],
        }
        _last_run.update(result)
        return result

    # ── Folder mode ────────────────────────────────────────────────────────────
    source = body.source_path or body.path or os.environ.get("AUDIO_SOURCE_PATH", "")
    if not source:
        raise HTTPException(
            status_code=422,
            detail=(
                "source_path is required for folder mode "
                "(or set the AUDIO_SOURCE_PATH environment variable)"
            ),
        )

    logger.info(f"[BATCH-FOLDER] Starting folder ingest from {source}")
    try:
        from services.batch_ingest_service import run_batch_ingest
        stats = run_batch_ingest(source, db, min_size_bytes=body.min_size_bytes)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"[BATCH-FOLDER] Unhandled error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

    result = {
        "status": "complete",
        "source": "folder",
        "source_path": source,
        "ran_at": datetime.now(timezone.utc).isoformat(),
        "scanned": stats.scanned,
        "inserted": stats.inserted,
        "skipped_duplicate": stats.skipped_duplicate,
        "skipped_short": stats.skipped_short,
        "unmatched": stats.unmatched,
        "errors": stats.errors,
        "error_details": stats.error_details[:20],
        # Aliases matching frontend expectations
        "found": stats.scanned,
        "downloaded": stats.inserted,
        "skipped": stats.skipped_duplicate + stats.skipped_short,
    }
    _last_run.update(result)
    return result


@router.get("/status")
async def batch_ingest_status():
    """Return stats from the most recent batch ingest run."""
    if not _last_run:
        return {"status": "no_run", "message": "No batch ingest has been triggered yet"}
    return _last_run


@router.get("/probe")
async def probe_acr_wifi(url: str):
    """
    Debug endpoint: fetch raw content from an ACR WiFi server URL and return
    what the server actually serves. Use this to diagnose listing format issues.

    Example: GET /api/v1/batch-ingest/probe?url=http://192.168.40.116:8000
    """
    from urllib.request import urlopen, Request as UrlRequest
    from urllib.error import URLError
    import urllib.parse

    results = {}
    endpoints_to_try = ["/", "/list", "/recordings", "/files", "/api/list", "/api/recordings"]

    base = url.rstrip("/")
    for ep in endpoints_to_try:
        full_url = base + ep
        try:
            req = UrlRequest(full_url, headers={"User-Agent": "HorizonPRM-Probe/1.0"})
            with urlopen(req, timeout=8) as resp:
                content = resp.read(32768)  # first 32KB only
                content_type = resp.headers.get("Content-Type", "")
                results[ep] = {
                    "status": resp.status,
                    "content_type": content_type,
                    "size_bytes": len(content),
                    "preview": content.decode("utf-8", errors="replace")[:2000],
                }
        except Exception as e:
            results[ep] = {"error": str(e)}

    return {"url": base, "endpoints": results}
