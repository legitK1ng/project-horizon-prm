"""
ACR WiFi Ingestion Service — NLLAPPS ACR Phone format
==========================================================
ACR Phone's WiFi Web Server serves a SINGLE HTML page (~4MB) listing every
recording as: <li><a href="/?job=db&id=XXXX">Contact @ Time</a></li>

To download a recording: GET /?job=db&id=XXXX
  → Content-Type: application/octet-stream
  → Content-Disposition: attachment;filename="url-encoded-filename.m4a"

Flow:
  1. Fetch listing page → extract all record IDs + display names + dates
  2. Query call_recordings to find already-ingested originals
  3. Download NEW records in parallel (8 workers)
  4. Archive each to call_recordings (MD5 dedup at DB level)
  5. Start background thread: Whisper transcribe → AI brief → call_records + tasks
  6. Return stats (download count) immediately; transcription runs async
"""

import hashlib
import json
import logging
import re
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import unquote
from urllib.request import Request as UrlRequest, urlopen

logger = logging.getLogger(__name__)

DOWNLOAD_DIR = Path(__file__).resolve().parent.parent / "audio_ingest" / "wifi_downloads"


def _ensure_download_dir() -> Path:
    DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
    return DOWNLOAD_DIR


def _fetch_bytes(url: str, timeout: int = 60) -> bytes:
    req = UrlRequest(url, headers={"User-Agent": "HorizonPRM-WiFiSync/1.0", "Accept": "*/*"})
    with urlopen(req, timeout=timeout) as resp:
        return resp.read()


def _md5(data: bytes) -> str:
    return hashlib.md5(data).hexdigest()


# ── Listing Parser ─────────────────────────────────────────────────────────────

def _parse_listing_page(base_url: str) -> list[dict]:
    """
    Fetch the ACR WiFi listing page (~4MB HTML) and return all record descriptors.
    Each descriptor: {id: int, display: str, date: str | None}

    ACR Phone HTML format:
      <li class="date-header">Jun 18, 2026</li>
      <li><a href="/?job=db&id=10867">Gabby Cajucom @ 5:56 PM</a></li>
    """
    listing_url = base_url.rstrip("/") + "/"
    try:
        html_bytes = _fetch_bytes(listing_url, timeout=45)
    except HTTPError as e:
        if e.code in (404, 405):
            html_bytes = _fetch_bytes(base_url.rstrip("/"), timeout=45)
        else:
            raise ConnectionError(f"ACR WiFi server returned HTTP {e.code}: {base_url}")
    except (URLError, OSError) as e:
        raise ConnectionError(f"Cannot reach ACR WiFi server at {base_url}: {e}")

    text = html_bytes.decode("utf-8", errors="replace")
    logger.info(f"[WIFI] Listing page: {len(text):,} bytes from {base_url}")

    records: list[dict] = []
    current_date: str | None = None

    # Combined pattern: date headers OR record links
    combined = re.compile(
        r'<li[^>]*class=["\']date-header["\'][^>]*>\s*([^<]+)\s*</li>'
        r'|<li><a\s+href=["\'][^"\']*[?&](?:job=db&(?:amp;)?id=|id=)(\d+)[^"\']*["\']>\s*([^<]+)\s*</a></li>',
        re.IGNORECASE,
    )

    for m in combined.finditer(text):
        if m.group(1):
            current_date = m.group(1).strip()
        elif m.group(2):
            records.append({
                "id": int(m.group(2)),
                "display": m.group(3).strip(),
                "date": current_date,
            })

    logger.info(f"[WIFI] Parsed {len(records)} record IDs from listing page")
    return records


# ── Download ────────────────────────────────────────────────────────────────────

def _download_record(base_url: str, record_id: int) -> tuple[bytes, str] | None:
    """
    Download a single recording by ACR record ID.
    Returns (audio_bytes, filename) or None on failure.
    Filename is taken from Content-Disposition: attachment;filename="..."
    """
    url = base_url.rstrip("/") + f"/?job=db&id={record_id}"
    req = UrlRequest(url, headers={"User-Agent": "HorizonPRM-WiFiSync/1.0"})
    try:
        with urlopen(req, timeout=90) as resp:
            content_type = resp.headers.get("Content-Type", "")
            if "text/html" in content_type:
                return None  # page — not an audio file

            # Extract filename from Content-Disposition
            cd = resp.headers.get("Content-Disposition", "")
            filename: str | None = None
            for part in cd.split(";"):
                part = part.strip()
                if part.lower().startswith("filename="):
                    raw = part[9:].strip().strip('"\'')
                    filename = unquote(raw)
                    break

            if not filename:
                filename = f"acr_record_{record_id}.m4a"

            # Sanitize — take only the basename, strip path traversal
            filename = Path(filename).name or f"acr_record_{record_id}.m4a"

            data = resp.read()
            return (data, filename) if len(data) > 512 else None

    except Exception as e:
        logger.debug(f"[WIFI] Download failed for id={record_id}: {e}")
        return None


# ── Database helpers ────────────────────────────────────────────────────────────

def _get_existing_original_names(db: Any) -> set[str]:
    """Return all original_name values already archived (single bulk query)."""
    try:
        result = db.table("call_recordings").select("original_name").execute()
        return {r["original_name"] for r in (result.data or []) if r.get("original_name")}
    except Exception as e:
        logger.warning(f"[WIFI] Could not fetch existing filenames from DB: {e}")
        return set()


def _archive_to_db(db: Any, local_path: Path, filename: str, md5_hash: str,
                   display: str, date_str: str | None) -> bool:
    """Upsert a downloaded recording into call_recordings."""
    try:
        record = {
            "canonical_name": f"wifi_{md5_hash[:8]}_{filename}"[:255],
            "original_name": filename,
            "md5_hash": md5_hash,
            "status": "QUEUED",
            "file_path": str(local_path),
            "parse_notes": json.dumps({
                "source": "acr_wifi",
                "display_name": display,
                "date_str": date_str,
            }),
        }
        db.table("call_recordings").upsert(record, on_conflict="md5_hash").execute()
        return True
    except Exception as e:
        logger.error(f"[WIFI] DB archive failed for {filename}: {e}")
        return False


def _link_contact(db: Any, phone: str | None, name: str | None) -> str | None:
    """Resolve contact UUID from phone number or display name."""
    try:
        if phone:
            digits = "".join(c for c in phone if c.isdigit())
            if len(digits) >= 10:
                res = (
                    db.table("contacts").select("id")
                    .ilike("phone", f"%{digits[-10:]}").limit(1).execute()
                )
                if res.data:
                    return res.data[0]["id"]
        if name and name not in ("Unknown", "unknown", ""):
            res = (
                db.table("contacts").select("id")
                .ilike("full_name", f"%{name}%").limit(1).execute()
            )
            if res.data:
                return res.data[0]["id"]
    except Exception as e:
        logger.debug(f"[WIFI] Contact lookup error (non-fatal): {e}")
    return None


# ── Transcription pipeline ──────────────────────────────────────────────────────

def _run_transcription_pipeline(local_path: Path, db: Any, display: str,
                                 date_str: str | None, base_url: str) -> bool:
    """
    Full Whisper + AI brief pipeline for one audio file.
    Stores result in call_records. Returns True on success.
    """
    try:
        from services.audio_processing_service import process_audio_ingest
        from services.transcription_service import TranscriptionManager
        from services.ai_briefing_service import generate_call_brief
        from core.security.crypto import encrypt_data
        from services.acr_parser_reference import full_parse

        # Parse ACR filename for structured metadata
        parsed: dict = {}
        try:
            parsed = full_parse(local_path)
        except Exception:
            pass

        contact_name = parsed.get("contact_name") or display.split("@")[0].strip() or "Unknown"
        phone_number = parsed.get("phone_e164") or ""
        direction = parsed.get("direction") or ""
        duration = str(parsed.get("duration_sec") or "")

        # Determine timestamp
        call_timestamp = None
        dt_str = parsed.get("datetime_str")
        if dt_str and dt_str != "NODATE":
            try:
                dt = datetime.strptime(dt_str, "%Y-%m-%d_%H%M%S")
                call_timestamp = dt.replace(tzinfo=timezone.utc).isoformat()
            except Exception:
                pass
        if not call_timestamp and date_str:
            try:
                # date_str from HTML: "Jun 18, 2026"
                time_part = display.split("@")[-1].strip() if "@" in display else ""
                combined = f"{date_str} {time_part}".strip()
                for fmt in ("%b %d, %Y %I:%M %p", "%B %d, %Y %I:%M %p", "%b %d, %Y"):
                    try:
                        dt = datetime.strptime(combined, fmt)
                        call_timestamp = dt.replace(tzinfo=timezone.utc).isoformat()
                        break
                    except ValueError:
                        pass
            except Exception:
                pass

        # Convert to WAV and transcribe
        content = local_path.read_bytes()
        wav_path = process_audio_ingest(content, local_path.name)
        mgr = TranscriptionManager()
        transcript_text, segments, detected_language, audio_duration = mgr.run_transcription(wav_path)
        try:
            Path(wav_path).unlink(missing_ok=True)
        except Exception:
            pass

        if not transcript_text or len(transcript_text.strip()) < 5:
            return False

        # AI brief
        executive_brief = None
        if len(transcript_text) > 50:
            try:
                executive_brief = generate_call_brief(transcript_text, contact_name)
            except Exception as e:
                logger.warning(f"[WIFI-TRANSCRIBE] Brief failed: {e}")

        # Encrypt transcript
        transcript_encrypted = transcript_iv = None
        try:
            transcript_encrypted, transcript_iv = encrypt_data(transcript_text)
        except Exception:
            pass

        # Resolve contact FK
        contact_id = _link_contact(db, phone_number, contact_name)

        action_items = []
        sentiment = "Neutral"
        tags = []
        if executive_brief:
            action_items = executive_brief.get("action_items") or executive_brief.get("actionItems", [])
            sentiment = executive_brief.get("sentiment", "Neutral")
            tags = executive_brief.get("tags", [])

        payload = {
            "contact_name": contact_name,
            "phone_number": phone_number,
            "duration": duration or None,
            "acr_direction": direction or None,
            "acr_channel": "wifi_sync",
            "raw_transcript": transcript_text,
            "transcript": transcript_text,
            "transcript_encrypted": transcript_encrypted,
            "transcript_iv": transcript_iv,
            "executive_brief": executive_brief,
            "sentiment": sentiment,
            "tags": tags,
            "status": "completed",
            "timestamp": call_timestamp or datetime.now(timezone.utc).isoformat(),
            "contact_id": contact_id,
            "acr_pattern": parsed.get("pattern"),
            "acr_phone_e164": parsed.get("phone_e164"),
        }
        db.table("call_records").insert(payload).execute()

        # Mark archived record as completed
        db.table("call_recordings").update({"status": "COMPLETED"}).eq(
            "original_name", local_path.name
        ).execute()

        # Persist action items
        if action_items:
            try:
                task_rows = [
                    {
                        "title": item[:120],
                        "description": item,
                        "status": "pending",
                        "source": "ai_brief",
                        "contact_id": contact_id,
                        "contact_name": contact_name,
                        "ai_confidence": 0.85,
                    }
                    for item in action_items
                    if isinstance(item, str) and item
                ]
                if task_rows:
                    db.table("tasks").insert(task_rows).execute()
            except Exception as task_err:
                logger.warning(f"[WIFI-TRANSCRIBE] Task insert failed: {task_err}")

        logger.info(f"[WIFI-TRANSCRIBE] Done: {contact_name!r} ({len(transcript_text)} chars)")
        return True

    except Exception as e:
        logger.error(f"[WIFI-TRANSCRIBE] Pipeline failed for {local_path.name}: {e}", exc_info=True)
        return False


def _transcribe_queue(queue: list[dict], db: Any, base_url: str) -> None:
    """Background thread: transcribe downloaded files one by one."""
    total = len(queue)
    done = 0
    for item in queue:
        try:
            success = _run_transcription_pipeline(
                item["local_path"], db, item["display"], item["date"], base_url
            )
            if success:
                done += 1
        except Exception as e:
            logger.error(f"[WIFI-BG] Transcription failed for {item['local_path'].name}: {e}")
        logger.info(f"[WIFI-BG] Transcribed {done}/{total}")
    logger.info(f"[WIFI-BG] Background transcription complete: {done}/{total} succeeded")


# ── Parallel download worker ────────────────────────────────────────────────────

def _download_worker(args: tuple) -> dict:
    """Thread worker: download one recording, save to disk, return result dict."""
    base_url, record, download_dir, existing_names = args
    record_id = record["id"]
    display = record.get("display", "")
    date_str = record.get("date")

    try:
        result = _download_record(base_url, record_id)
        if result is None:
            return {"status": "error", "id": record_id, "error": "empty or HTML response"}

        audio_bytes, filename = result

        if filename in existing_names:
            return {"status": "skipped", "id": record_id, "filename": filename}

        md5_hash = _md5(audio_bytes)

        # Save to disk
        local_path = download_dir / filename
        if local_path.exists():
            existing_md5 = _md5(local_path.read_bytes())
            if existing_md5 == md5_hash:
                return {"status": "skipped", "id": record_id, "filename": filename}
            # Same name, different content — append MD5 prefix to disambiguate
            stem, ext = filename.rsplit(".", 1) if "." in filename else (filename, "m4a")
            local_path = download_dir / f"{stem}_{md5_hash[:6]}.{ext}"

        local_path.write_bytes(audio_bytes)
        logger.info(f"[WIFI] ↓ {filename} ({len(audio_bytes):,} bytes) id={record_id}")

        return {
            "status": "downloaded",
            "id": record_id,
            "filename": filename,
            "local_path": local_path,
            "md5": md5_hash,
            "display": display,
            "date": date_str,
        }

    except Exception as e:
        return {"status": "error", "id": record_id, "error": str(e)}


# ── Public API ──────────────────────────────────────────────────────────────────

def fetch_recording_list(base_url: str) -> list[dict]:
    """
    Return list of recording descriptors from ACR WiFi server.
    Each: {id: int, display: str, date: str | None}
    """
    return _parse_listing_page(base_url)


def wifi_batch_ingest(base_url: str, db: Any) -> dict:
    """
    Full ACR WiFi ingestion pipeline.

    1. Parse listing page → all record IDs (fast, synchronous)
    2. Parallel download of new recordings (8 workers)
    3. Archive each to call_recordings table
    4. Background thread: Whisper transcription → call_records + tasks
    5. Return stats (download counts); transcription continues async

    Args:
        base_url: ACR WiFi server URL (e.g. http://192.168.40.116:8000)
        db:       Supabase client

    Returns:
        {found, downloaded, skipped, transcribed, errors, error_details}
    """
    base_url = base_url.rstrip("/")
    download_dir = _ensure_download_dir()

    stats: dict = {
        "found": 0,
        "downloaded": 0,
        "skipped": 0,
        "transcribed": 0,
        "errors": 0,
        "error_details": [],
    }

    # ── Step 1: Parse listing ──────────────────────────────────────────────────
    try:
        records = _parse_listing_page(base_url)
    except ConnectionError:
        raise
    except Exception as e:
        raise ConnectionError(f"Listing parse failed for {base_url}: {e}")

    stats["found"] = len(records)
    if not records:
        logger.warning(f"[WIFI] No records found at {base_url}")
        return stats

    # ── Step 2: Pre-filter with existing DB names (single query) ──────────────
    existing_names = _get_existing_original_names(db)
    new_records = [r for r in records if True]  # actual filter happens in worker after filename known
    logger.info(
        f"[WIFI] {len(records)} on device | {len(existing_names)} already archived | "
        f"downloading up to {len(new_records)} new"
    )

    # ── Step 3: Parallel downloads (8 workers) ─────────────────────────────────
    download_args = [(base_url, r, download_dir, existing_names) for r in records]
    transcription_queue: list[dict] = []

    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(_download_worker, a): a for a in download_args}
        for fut in as_completed(futures):
            result = fut.result()
            status = result["status"]
            if status == "downloaded":
                stats["downloaded"] += 1
                # Archive to DB immediately
                _archive_to_db(
                    db,
                    result["local_path"],
                    result["filename"],
                    result["md5"],
                    result.get("display", ""),
                    result.get("date"),
                )
                transcription_queue.append(result)
                # Mark as seen so other workers skip it
                existing_names.add(result["filename"])
            elif status == "skipped":
                stats["skipped"] += 1
            else:
                stats["errors"] += 1
                if len(stats["error_details"]) < 30:
                    stats["error_details"].append(
                        f"ID {result['id']}: {result.get('error', 'unknown')}"
                    )

            completed = stats["downloaded"] + stats["skipped"] + stats["errors"]
            if completed % 200 == 0:
                logger.info(
                    f"[WIFI] Progress {completed}/{len(records)}: "
                    f"{stats['downloaded']} new | {stats['skipped']} skip | {stats['errors']} err"
                )

    logger.info(
        f"[WIFI] Download complete — {stats['downloaded']} new, "
        f"{stats['skipped']} skipped, {stats['errors']} errors"
    )

    # ── Step 4: Background transcription ──────────────────────────────────────
    if transcription_queue:
        t = threading.Thread(
            target=_transcribe_queue,
            args=(transcription_queue, db, base_url),
            daemon=True,
            name="wifi-transcribe",
        )
        t.start()
        logger.info(
            f"[WIFI] Started background transcription thread for "
            f"{len(transcription_queue)} files"
        )

    return stats
