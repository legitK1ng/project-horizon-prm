"""
POST /api/v1/batch-ingest               — trigger ingestion from a source ('folder' or 'wifi')
POST /api/v1/batch-ingest/transcribe    — pick up pending stubs, run Whisper + AI brief
POST /api/v1/batch-ingest/resolve-stubs — reverse-lookup unknown phone numbers, promote stubs to named contacts
GET  /api/v1/batch-ingest/status        — query most recent run stats + live Supabase counts
GET  /api/v1/batch-ingest/probe         — debug endpoint to inspect ACR WiFi Web Server endpoints

Supported source types (pass in `source` field of POST /api/v1/batch-ingest):
  'folder'  — scan a local directory (default when `url` not given)
  'wifi'    — pull recordings from ACR Phone WiFi Web Server (`url` required)
"""
import asyncio
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter()

# In-process state for the last runs (single-worker; replace with Redis for multi-worker)
_last_run: dict = {}
_last_ingest: dict = {}
_last_transcribe: dict = {}


class BatchIngestRequest(BaseModel):
    # Source type selector
    source: str | None = Field(None, description="'wifi' | 'folder'. Defaults to 'folder'.")
    # WiFi source
    url: str | None = Field(None, description="ACR WiFi Web Server base URL (required when source='wifi')")
    # Folder source
    source_path: str | None = Field(None, description="Local folder path to scan (overrides AUDIO_SOURCE_PATH)")
    path: str | None = Field(None, description="Alias for source_path")
    min_size_bytes: int = Field(4096, description="Skip files smaller than this (bytes)")


class TranscribeRequest(BaseModel):
    limit: int = 50                   # max records to process per call
    re_resolve_contacts: bool = True  # re-run contact resolution on unlinked records


class ResolveStubsRequest(BaseModel):
    limit: int = 50   # max stubs to process per call (respects rate limits)


# ── Helpers (Resilient Contact & Phone Resolution) ─────────────────────────────

def _parse_phone_from_filename(filename: str) -> str:
    """Extract normalized E.164 phone number from an ACR filename if present."""
    if not filename:
        return ""
    try:
        from services.acr_parser_reference import parse_acr_filename, norm_phone
        p = Path(filename)
        parsed = parse_acr_filename(p.stem, p.suffix)
        phone = parsed.get("phone") or ""
        return norm_phone(phone) if phone else ""
    except Exception as e:
        logger.debug(f"[BATCH] Filename phone parse skipped for {filename!r}: {e}")
        return ""


def _resolve_contact_fallback(phone: str, contact_name: str, db: Any) -> tuple[str | None, str | None]:
    """
    Resolve a contact by phone or name using services.phone_resolver if present,
    otherwise falling back to services.batch_ingest_service._link_contact.
    """
    try:
        from services.phone_resolver import resolve_contact  # type: ignore
        return resolve_contact(phone, contact_name, db)
    except ImportError:
        pass

    try:
        from services.batch_ingest_service import _link_contact
        cid = _link_contact(db, {"phone_e164": phone, "contact_name": contact_name})
        return cid, contact_name if cid else None
    except Exception as e:
        logger.debug(f"[BATCH] Fallback contact resolution failed: {e}")
        return None, None


def _lookup_phone_fallback(phone: str) -> str | None:
    """
    Reverse-lookup a phone number using services.reverse_lookup_service if present,
    otherwise returning None gracefully.
    """
    try:
        from services.reverse_lookup_service import lookup_phone  # type: ignore
        return lookup_phone(phone)
    except ImportError:
        logger.debug("[RESOLVE] services.reverse_lookup_service not installed; skipping external scrape.")
        return None
    except Exception as e:
        logger.warning(f"[RESOLVE] Reverse lookup failed for {phone}: {e}")
        return None


# ── POST /batch-ingest ─────────────────────────────────────────────────────────

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
        _last_ingest.update(result)
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

    unmatched_val = getattr(stats, "unmatched", getattr(stats, "unmatched_pattern", 0))
    result = {
        "status": "complete",
        "source": "folder",
        "source_path": source,
        "ran_at": datetime.now(timezone.utc).isoformat(),
        "scanned": stats.scanned,
        "inserted": stats.inserted,
        "updated": getattr(stats, "updated", 0),
        "skipped_duplicate": stats.skipped_duplicate,
        "skipped_short": stats.skipped_short,
        "unmatched": unmatched_val,
        "unmatched_pattern": unmatched_val,
        "contact_linked": getattr(stats, "contact_linked", 0),
        "contact_unlinked": getattr(stats, "contact_unlinked", 0),
        "errors": stats.errors,
        "error_details": stats.error_details[:20],
        # Aliases matching frontend expectations
        "found": stats.scanned,
        "downloaded": stats.inserted,
        "skipped": stats.skipped_duplicate + stats.skipped_short,
    }
    _last_run.update(result)
    _last_ingest.update(result)
    return result


# ── POST /batch-ingest/transcribe ─────────────────────────────────────────────

@router.post("/transcribe")
async def transcribe_pending(body: TranscribeRequest, req: Request):
    """
    Pick up call_records where status='pending' AND audio_path IS NOT NULL,
    run Whisper transcription, generate AI brief, re-resolve contacts, and
    flip status to 'completed'.

    Call this endpoint repeatedly until pending_remaining = 0.
    Designed to be safe to re-call — already-completed records are skipped.
    """
    db = getattr(req.app.state, "supabase", None)
    if not db:
        raise HTTPException(status_code=503, detail="Database not available")

    try:
        stats = _run_transcription_worker(db, body.limit, body.re_resolve_contacts)
    except Exception as e:
        logger.error(f"[TRANSCRIBE] Unhandled error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    result = {
        "status":               "complete",
        "ran_at":               datetime.now(timezone.utc).isoformat(),
        "processed":            stats["processed"],
        "transcribed":          stats["transcribed"],
        "contact_linked":       stats["contact_linked"],
        "skipped_missing_file": stats["skipped_missing_file"],
        "errors":               stats["errors"],
        "pending_remaining":    stats["pending_remaining"],
        "error_details":        stats["error_details"][:20],
    }
    _last_transcribe.update(result)
    _last_run.update(result)
    return result


def _run_batch_transcribe(db, limit: int = 50, re_resolve: bool = True) -> dict:
    """Alias for _run_transcription_worker preserved for backward compatibility."""
    return _run_transcription_worker(db, limit=limit, re_resolve=re_resolve)


def _run_transcription_worker(db, limit: int, re_resolve: bool) -> dict:
    from services.transcription_service import transcribe_audio
    from services.audio_processing_service import process_audio_ingest
    from services.ai_briefing_service import generate_call_brief

    stats = {
        "processed": 0,
        "transcribed": 0,
        "contact_linked": 0,
        "skipped_missing_file": 0,
        "errors": 0,
        "pending_remaining": 0,
        "error_details": [],
    }

    # Fetch a batch of pending records that have an audio file path
    response = (
        db.table("call_records")
        .select("id, audio_path, contact_name, acr_phone_e164, phone_number, contact_id")
        .eq("status", "pending")
        .not_.is_("audio_path", "null")
        .order("created_at", desc=False)
        .limit(limit)
        .execute()
    )
    records = response.data or []

    # Count how many are still pending after this batch
    count_resp = (
        db.table("call_records")
        .select("id", count="exact")
        .eq("status", "pending")
        .not_.is_("audio_path", "null")
        .execute()
    )
    total_pending = count_resp.count if hasattr(count_resp, "count") and count_resp.count is not None else 0
    stats["pending_remaining"] = max(0, total_pending - len(records))

    for rec in records:
        record_id = rec["id"]
        audio_path = rec.get("audio_path", "")
        contact_name = rec.get("contact_name", "Unknown")
        phone = rec.get("acr_phone_e164") or rec.get("phone_number", "")
        if not phone and audio_path:
            phone = _parse_phone_from_filename(audio_path)

        stats["processed"] += 1
        wav_path = None

        try:
            # Skip if file no longer on disk
            if not audio_path or not Path(audio_path).exists():
                stats["skipped_missing_file"] += 1
                logger.warning(f"[TRANSCRIBE] File missing, marking error: {audio_path}")
                db.table("call_records").update({"status": "error"}).eq("id", record_id).execute()
                continue

            # Convert to WAV if not already (handles .amr, .m4a, .ogg etc.)
            p = Path(audio_path)
            if p.suffix.lower() != ".wav":
                with open(audio_path, "rb") as f:
                    content = f.read()
                wav_path = process_audio_ingest(content, p.name)
            else:
                wav_path = audio_path

            # Transcribe
            logger.info(f"[TRANSCRIBE] Running Whisper on {p.name}")
            transcript = transcribe_audio(wav_path)
            stats["transcribed"] += 1

            # AI brief (Gemini) — non-fatal if unavailable
            brief = {}
            try:
                if transcript and not transcript.startswith("["):
                    brief = generate_call_brief(transcript, contact_name)
            except Exception as e:
                logger.warning(f"[TRANSCRIBE] AI brief failed for {record_id}: {e}")
                brief = {"summary": "Transcription complete. Brief unavailable.", "actionItems": []}

            # Re-resolve contact if still unlinked
            contact_id = rec.get("contact_id")
            if re_resolve and not contact_id and (phone or contact_name):
                contact_id, _ = _resolve_contact_fallback(phone, contact_name, db)
                if contact_id:
                    stats["contact_linked"] += 1

            # Persist all results
            update = {
                "transcript":                transcript,
                "raw_transcript":            transcript,
                "executive_brief":           brief,
                "sentiment":                 brief.get("sentiment", "Neutral"),
                "tags":                      brief.get("tags", []),
                "recommended_followup_date": brief.get("recommended_followup_date"),
                "draft_followup_message":    brief.get("draft_followup_message"),
                "open_commitments":          brief.get("open_commitments", []),
                "status":                    "completed",
            }
            if contact_id:
                update["contact_id"] = contact_id

            db.table("call_records").update(update).eq("id", record_id).execute()
            logger.info(f"[TRANSCRIBE] Completed {record_id} ({len(transcript)} chars)")

        except Exception as e:
            stats["errors"] += 1
            msg = f"{record_id}: {e}"
            stats["error_details"].append(msg)
            logger.error(f"[TRANSCRIBE] ERROR {msg}")
            try:
                db.table("call_records").update({"status": "error"}).eq("id", record_id).execute()
            except Exception:
                pass

        finally:
            # Clean up temp WAV if we created one
            if wav_path and wav_path != audio_path:
                try:
                    from services.audio_processing_service import cleanup_processed_audio
                    cleanup_processed_audio(wav_path)
                except Exception:
                    pass

    return stats


# ── POST /batch-ingest/resolve-stubs ──────────────────────────────────────────

def _run_resolve_stubs(db, limit: int = 50) -> dict:
    stats = {
        "processed": 0,
        "identified": 0,
        "merged_into_existing": 0,
        "promoted": 0,
        "not_found": 0,
        "pending_remaining": 0,
    }

    # Fetch stubs that still have the generic "Unknown: ..." name and a real phone
    stubs_resp = (
        db.table("contacts")
        .select("id, phone, full_name")
        .contains("tags", ["auto-stub"])
        .not_.is_("phone", "null")
        .neq("phone", "")
        .like("full_name", "Unknown:%")
        .limit(limit)
        .execute()
    )
    stubs = stubs_resp.data or []

    for stub in stubs:
        stub_id = stub["id"]
        phone   = stub["phone"]
        stats["processed"] += 1

        name = _lookup_phone_fallback(phone)
        if not name:
            stats["not_found"] += 1
            continue

        stats["identified"] += 1

        # Check if a real named contact already exists for this name
        existing = (
            db.table("contacts")
            .select("id")
            .ilike("full_name", name)
            .not_.contains("tags", ["auto-stub"])
            .limit(1)
            .execute()
        )

        if existing.data:
            # Merge: re-link all call_records from stub → real contact, then delete stub
            real_id = existing.data[0]["id"]
            db.table("call_records").update({"contact_id": real_id}) \
                .eq("contact_id", stub_id).execute()
            db.table("contacts").delete().eq("id", stub_id).execute()
            stats["merged_into_existing"] += 1
            logger.info(f"[RESOLVE] Merged stub {stub_id} → existing contact {real_id} ('{name}')")
        else:
            # Promote stub: set real name, strip auto-stub tag
            parts = name.split(None, 1)
            db.table("contacts").update({
                "first_name": parts[0],
                "last_name":  parts[1] if len(parts) > 1 else None,
                "full_name":  name,
                "tags":       [],
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", stub_id).execute()
            stats["promoted"] += 1
            logger.info(f"[RESOLVE] Promoted stub {stub_id}: '{name}' ({phone})")

    # Count remaining work
    remaining_resp = (
        db.table("contacts")
        .select("id", count="exact")
        .contains("tags", ["auto-stub"])
        .not_.is_("phone", "null")
        .like("full_name", "Unknown:%")
        .execute()
    )
    stats["pending_remaining"] = (
        remaining_resp.count if hasattr(remaining_resp, "count") and remaining_resp.count is not None else 0
    )

    return stats


@router.post("/resolve-stubs")
async def resolve_stub_contacts(body: ResolveStubsRequest, req: Request):
    """
    Reverse-lookup auto-stub contacts that have valid phone numbers but no
    identified name.

    When a name is found:
      - If a real (non-stub) contact with that name already exists, the stubs'
        call_records are re-linked to the real contact and the stub is deleted.
      - Otherwise the stub is promoted: full_name / first_name updated,
        auto-stub tag removed.

    Call repeatedly (pending_remaining > 0) to drain all stubs.
    """
    db = getattr(req.app.state, "supabase", None)
    if not db:
        raise HTTPException(status_code=503, detail="Database not available")

    stats = _run_resolve_stubs(db, limit=body.limit)
    return {"status": "complete", **stats}


# ── GET /batch-ingest/status ───────────────────────────────────────────────────

@router.get("/status")
async def batch_ingest_status(req: Request):
    """Return stats from the most recent batch ingest/transcribe runs, plus live DB counts."""
    db = getattr(req.app.state, "supabase", None)

    live_counts: dict[str, Any] = {}
    total_call_records = 0
    transcribed_count = 0
    pending_count = 0
    failed_count = 0
    stub_contacts_count = 0

    if db:
        try:
            for status_val in ("pending", "completed", "error", "processing"):
                r = (
                    db.table("call_records")
                    .select("id", count="exact")
                    .eq("status", status_val)
                    .execute()
                )
                cnt = r.count if hasattr(r, "count") and r.count is not None else 0
                live_counts[status_val] = cnt
                total_call_records += cnt
            transcribed_count = live_counts.get("completed", 0)
            pending_count = live_counts.get("pending", 0)
            failed_count = live_counts.get("error", 0)

            stub_r = (
                db.table("contacts")
                .select("id", count="exact")
                .contains("tags", ["auto-stub"])
                .execute()
            )
            stub_contacts_count = (
                stub_r.count if hasattr(stub_r, "count") and stub_r.count is not None else 0
            )
        except Exception as e:
            live_counts["error_fetching"] = str(e)

    base_status = _last_run if _last_run else {"status": "no_run", "message": "No batch ingest has been triggered yet"}
    return {
        **base_status,
        "last_ingest": _last_ingest or {"status": "no_run"},
        "last_transcribe": _last_transcribe or {"status": "no_run"},
        "live_call_records": live_counts,
        "total_call_records": total_call_records,
        "transcribed": transcribed_count,
        "pending_transcription": pending_count,
        "failed_transcription": failed_count,
        "stub_contacts": stub_contacts_count,
    }


# ── GET /batch-ingest/probe ────────────────────────────────────────────────────

@router.get("/probe")
async def probe_acr_wifi(url: str):
    """
    Debug endpoint: fetch raw content from an ACR WiFi server URL and return
    what the server actually serves. Use this to diagnose listing format issues.

    Example: GET /api/v1/batch-ingest/probe?url=http://192.168.40.116:8000
    """
    from urllib.request import urlopen, Request as UrlRequest

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
