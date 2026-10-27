"""
Vault Scanner HTTP router — lets the web/mobile dashboard trigger and monitor
the back-catalog transcription scan.

Mounted on the ingestion server (port 9000) as /v1/scan.

Endpoints:
  POST /v1/scan/backfill  -> run one full pass now (returns counts)
  GET  /v1/scan/status    -> last-run stats + checkpoint size
  POST /v1/scan/watch/toggle -> enable/disable the always-on loop (future)
"""
import json
import logging
import os
import threading
from pathlib import Path

from fastapi import APIRouter, Request

logger = logging.getLogger(__name__)
router = APIRouter()

_state = {
    "last_run": None,
    "running": False,
}


def _run_now() -> dict:
    from db.supabase_client import get_supabase
    from services.drive_connector import DriveConnector
    from services.vault_scanner_service import (
        _load_checkpoint,
        scan_pass,
        STAGING,
    )

    checkpoint = _load_checkpoint()
    totals = scan_pass(lambda fid: DriveConnector(fid, STAGING), checkpoint)
    _state["last_run"] = totals
    return totals


@router.post("/backfill")
async def scan_backfill(req: Request):
    """Trigger a single backfill pass over the Drive vault + raw folder."""
    if _state["running"]:
        return {"status": "already_running", "last_run": _state["last_run"]}
    try:
        _state["running"] = True
        totals = _run_now()
        return {"status": "complete", **totals}
    except Exception as e:
        logger.exception("[SCAN] backfill failed")
        return {"status": "error", "detail": str(e)}
    finally:
        _state["running"] = False


@router.get("/status")
async def scan_status():
    ckpt = Path(os.environ.get("SCANNER_CHECKPOINT", "audio_ingest/scan_checkpoint.json"))
    size = 0
    if ckpt.exists():
        try:
            size = len(json.loads(ckpt.read_text()).get("processed_ids", []))
        except Exception:
            size = 0
    return {
        "status": "active",
        "running": _state["running"],
        "last_run": _state["last_run"],
        "checkpoint_processed_ids": size,
    }
