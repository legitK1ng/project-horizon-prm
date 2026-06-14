"""
Batch ingestion orchestrator for ACR audio archives.

Walk a source directory, parse every audio filename via acr_parser_reference,
MD5-deduplicate, and upsert to call_recordings. Rows with status=QUEUED are
picked up by the transcription pipeline separately.
"""
import hashlib
import logging
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

AUDIO_EXTENSIONS = {".amr", ".m4a", ".mp3", ".wav", ".ogg", ".aac"}


@dataclass
class IngestStats:
    scanned: int = 0
    inserted: int = 0
    skipped_duplicate: int = 0
    skipped_short: int = 0
    errors: int = 0
    unmatched: int = 0
    error_details: list[str] = field(default_factory=list)


def _md5(path: Path) -> str:
    h = hashlib.md5()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _parse_call_timestamp(dt_str: str) -> str | None:
    """Convert '2025-08-09_173410' to ISO-8601 UTC string."""
    if not dt_str or dt_str == "NODATE":
        return None
    try:
        dt = datetime.strptime(dt_str, "%Y-%m-%d_%H%M%S")
        return dt.replace(tzinfo=timezone.utc).isoformat()
    except ValueError:
        return None


def _build_record(parsed: dict, audio_path: Path, md5: str) -> dict:
    """Map full_parse() output to call_recordings columns."""
    call_ts = _parse_call_timestamp(parsed.get("datetime_str", ""))
    mtime_ts = None
    if parsed.get("mtime"):
        mtime_ts = datetime.fromtimestamp(parsed["mtime"], tz=timezone.utc).isoformat()

    return {
        "canonical_name":   parsed["canonical_name"],
        "original_name":    parsed["original_name"],
        "original_path":    parsed["original_path"],
        "pattern":          parsed["pattern"],
        "contact_name":     parsed["contact_name"] or None,
        "phone_e164":       parsed["phone_e164"] or None,
        "direction":        parsed["direction"] or "",
        "channel":          parsed["channel"],
        "datetime_str":     parsed["datetime_str"],
        "call_timestamp":   call_ts,
        "ch_idx":           parsed["ch_idx"] or "",
        "confidence":       parsed["confidence"],
        "parse_notes":      parsed["parse_notes"] or None,
        "sidecar_path":     parsed["sidecar_path"] or None,
        "duration_ms":      parsed["duration_ms"],
        "duration_sec":     parsed["duration_sec"],
        "lat":              parsed["lat"],
        "lon":              parsed["lon"],
        "address":          parsed["address"] or None,
        "size_bytes":       parsed["size_bytes"],
        "mtime":            mtime_ts,
        "md5_hash":         md5,
        "status":           "QUEUED",
    }


def _link_contact(db: Any, record: dict) -> str | None:
    """Return contact UUID for phone_e164 or contact_name, or None."""
    phone = record.get("phone_e164")
    name  = record.get("contact_name")
    try:
        if phone:
            res = db.table("contacts").select("id").eq("phone", phone).limit(1).execute()
            if res.data:
                return res.data[0]["id"]
            # Fallback: last-10-digit suffix match
            if len(phone) >= 10:
                suffix = phone[-10:]
                res = db.table("contacts").select("id").ilike("phone", f"%{suffix}").limit(1).execute()
                if res.data:
                    return res.data[0]["id"]
        if name and name not in ("unknown", "anon", "voice-recording", "zoom-meeting", "dictaphone", "fb-cube"):
            res = db.table("contacts").select("id").ilike("full_name", f"%{name}%").limit(1).execute()
            if res.data:
                return res.data[0]["id"]
    except Exception as e:
        logger.debug(f"[BATCH] contact lookup skipped: {e}")
    return None


def run_batch_ingest(source_path: str, db: Any, min_size_bytes: int = 4096) -> IngestStats:
    """
    Walk source_path, parse every audio file, upsert to call_recordings.

    Args:
        source_path:    Directory to scan recursively.
        db:             Supabase client (app.state.supabase).
        min_size_bytes: Skip files smaller than this (default 4 KB — avoids
                        zero-byte placeholders and corrupt micro-fragments).

    Returns:
        IngestStats with counts for each outcome category.
    """
    from services.acr_parser_reference import full_parse  # local import — heavy module

    stats = IngestStats()
    root = Path(source_path)

    if not root.exists():
        raise FileNotFoundError(f"Source path does not exist: {source_path}")

    # Collect all audio files first so we can report total
    audio_files = [
        p for p in root.rglob("*")
        if p.is_file() and p.suffix.lower() in AUDIO_EXTENSIONS
    ]
    logger.info(f"[BATCH] Found {len(audio_files)} audio files under {source_path}")

    for audio_path in audio_files:
        stats.scanned += 1
        try:
            # Skip tiny files (corrupt / placeholder)
            if audio_path.stat().st_size < min_size_bytes:
                stats.skipped_short += 1
                logger.debug(f"[BATCH] SKIP short: {audio_path.name}")
                continue

            # MD5 dedup — compute before parse (cheaper to bail early)
            md5 = _md5(audio_path)
            existing = db.table("call_recordings").select("id, status").eq("md5_hash", md5).limit(1).execute()
            if existing.data:
                stats.skipped_duplicate += 1
                logger.debug(f"[BATCH] SKIP dup md5={md5[:8]}: {audio_path.name}")
                continue

            # Parse filename + sidecar
            parsed = full_parse(audio_path)

            if parsed["pattern"] == "X":
                stats.unmatched += 1
                logger.warning(f"[BATCH] UNMATCHED: {audio_path.name} — {parsed['parse_notes']}")

            # Build DB record
            record = _build_record(parsed, audio_path, md5)

            # Contact FK linkage
            contact_id = _link_contact(db, record)
            if contact_id:
                record["contact_id"] = contact_id

            # Upsert on canonical_name (handles re-runs gracefully)
            db.table("call_recordings").upsert(
                record,
                on_conflict="canonical_name",
            ).execute()

            stats.inserted += 1
            logger.info(f"[BATCH] INSERT [{parsed['pattern']}] {record['canonical_name']}")

        except Exception as e:
            stats.errors += 1
            msg = f"{audio_path.name}: {e}"
            stats.error_details.append(msg)
            logger.error(f"[BATCH] ERROR {msg}")
            # Emit to pipeline_events so the dashboard registers the failure
            try:
                from services.event_emitter import emit_event
                emit_event(db, "batch_ingest", "error", error=msg[:500],
                           detail={"file": audio_path.name})
            except Exception:
                pass

    logger.info(
        f"[BATCH] Done — scanned={stats.scanned} inserted={stats.inserted} "
        f"dup={stats.skipped_duplicate} short={stats.skipped_short} "
        f"unmatched={stats.unmatched} errors={stats.errors}"
    )
    return stats
