"""
Horizon Vault Scanner — backfill + continuous watch for the transcription pipeline.

WHY THIS EXISTS
---------------
The live ACR path (routers/transcriptions.py) transcribes audio and writes
`call_records` rows that the web/mobile platform reads. But the *back-catalog*
in Google Drive (Horizon_Data/Audio_Archive) and new arrivals in ACR_Audio_Raw
are never processed: nothing pulls them down, and even the batch folder
ingestor (services/batch_ingest_service.py) only lands rows in
`call_recordings` with status=QUEUED, which no code path ever transcribes.

This scanner closes that gap:
  1. Pulls audio out of Drive (Audio_Archive + ACR_Audio_Raw)
  2. Transcribes each file with the SAME engine the live path uses
     (services.transcription_service.TranscriptionManager)
  3. Inserts a `call_records` row with status='completed' (the table the
     platform reads), including the executive brief + embedding
  4. Is idempotent (dedup on md5) and resumable (checkpoint of processed ids)

It deliberately mirrors routers/calls.py + routers/transcriptions.py so the
output is indistinguishable from a live ingestion.

Run standalone:  python -m services.vault_scanner_service
(Also exposed via services.scanner_router for a /v1/scan/backfill trigger.)
"""
import json
import logging
import os
import time
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger("horizon.scanner")

# Drive folder IDs (override via env). From the Horizon Field Manual.
AUDIO_ARCHIVE_ID = os.environ.get("DRIVE_AUDIO_ARCHIVE_ID", "1asJrk9wkTnP23GSaYGrjK0YjdNYg-9ai")
ACR_RAW_ID = os.environ.get("DRIVE_ACR_RAW_ID", "1dW4J3CVmX4iL94zzS_SJwuAxyudp8Cmv")

STAGING = os.environ.get("SCANNER_STAGING", "audio_ingest/vault_staging")
CHECKPOINT = os.environ.get("SCANNER_CHECKPOINT", "audio_ingest/scan_checkpoint.json")
POLL_SECONDS = int(os.environ.get("SCANNER_POLL_SECONDS", "300"))
WHISPER_MODEL_SIZE = os.environ.get("WHISPER_MODEL_SIZE", "tiny")
MAX_FILE_BYTES = int(os.environ.get("SCANNER_MAX_FILE_BYTES", str(100 * 1024 * 1024)))

AUDIO_EXT = {".amr", ".m4a", ".mp3", ".wav", ".ogg", ".aac"}


# ─────────────────────────────────────────────────────────────────────────────
# Checkpoint (idempotency)
# ─────────────────────────────────────────────────────────────────────────────
def _load_checkpoint() -> set:
    p = Path(CHECKPOINT)
    if p.exists():
        try:
            return set(json.loads(p.read_text()).get("processed_ids", []))
        except Exception:
            return set()
    return set()


def _save_checkpoint(ids: set):
    Path(CHECKPOINT).parent.mkdir(parents=True, exist_ok=True)
    Path(CHECKPOINT).write_text(json.dumps({"processed_ids": sorted(ids)}))


def _md5(path: Path) -> str:
    import hashlib
    h = hashlib.md5()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


# ─────────────────────────────────────────────────────────────────────────────
# Core: transcribe one local file and persist a completed call_records row
# ─────────────────────────────────────────────────────────────────────────────
def process_local_audio(local_path: Path, db) -> dict:
    """Full pipeline for a single downloaded audio file.

    Returns a status dict: {status: 'inserted'|'skipped'|'error', ...}.
    Mirrors routers/calls.py + routers/transcriptions.py behavior.
    """
    from services.acr_parser_reference import full_parse, norm_phone
    from services.audio_processing_service import process_audio_ingest
    from services.transcription_service import TranscriptionManager
    from services.ai_briefing_service import generate_call_brief
    from services.embedding_service import embed_text
    from core.security.crypto import encrypt_data

    md5 = _md5(local_path)

    # Idempotency: skip if this exact file already produced a completed record.
    try:
        existing = (
            db.table("call_recordings")
            .select("id, status")
            .eq("md5_hash", md5)
            .limit(1)
            .execute()
        )
        if existing.data:
            return {"status": "skipped", "reason": "md5 already archived", "md5": md5}
    except Exception:
        pass  # DB check is best-effort; proceed.

    # 1. Parse ACR filename for contact/phone metadata
    try:
        parsed = full_parse(local_path)
        contact_name = parsed.get("contact_name") or "Unknown"
        phone = parsed.get("phone_e164") or ""
        timestamp = None
        if parsed.get("datetime_str") and parsed["datetime_str"] != "NODATE":
            try:
                dt = datetime.strptime(parsed["datetime_str"], "%Y-%m-%d_%H%M%S")
                timestamp = dt.replace(tzinfo=timezone.utc).isoformat()
            except ValueError:
                pass
    except Exception:
        parsed = {}
        contact_name, phone, timestamp = "Unknown", "", None

    # 2. Normalize audio -> 16k mono WAV
    try:
        with local_path.open("rb") as f:
            content = f.read()
        wav_path = process_audio_ingest(content, local_path.name)
    except Exception as e:
        logger.error(f"[SCAN] audio convert failed for {local_path.name}: {e}")
        return {"status": "error", "reason": f"convert: {e}"}

    # 3. Transcribe (same engine as live path)
    try:
        transcript, _segments, _lang, _dur = TranscriptionManager().run_transcription(
            wav_path
        )
    except Exception as e:
        logger.error(f"[SCAN] whisper failed for {local_path.name}: {e}")
        return {"status": "error", "reason": f"whisper: {e}"}

    if not transcript or len(transcript.strip()) < 5:
        return {"status": "error", "reason": "empty transcript"}

    # 4. Executive brief
    brief = {}
    try:
        if len(transcript) > 50:
            brief = generate_call_brief(transcript, contact_name)
    except Exception as e:
        logger.warning(f"[SCAN] brief failed (non-blocking) for {local_path.name}: {e}")

    # 5. Encrypt at rest (REQ-037, same as live path)
    transcript_encrypted = transcript_iv = None
    try:
        transcript_encrypted, transcript_iv = encrypt_data(transcript)
    except Exception as e:
        logger.warning(f"[SCAN] encryption failed (plaintext fallback) for {local_path.name}: {e}")

    # 6. Contact linkage
    contact_id = None
    try:
        if phone:
            digits = "".join(c for c in phone if c.isdigit())
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
    except Exception as e:
        logger.warning(f"[SCAN] contact lookup failed (non-critical): {e}")

    # 7. Embedding for RAG
    embedding = None
    try:
        embed_input = " ".join(
            filter(
                None,
                [
                    brief.get("summary", ""),
                    brief.get("title", ""),
                    " ".join(brief.get("tags", [])),
                    transcript[:2000],
                ],
            )
        )
        if embed_input.strip():
            embedding = embed_text(embed_input)
    except Exception as e:
        logger.warning(f"[SCAN] embedding failed (non-blocking) for {local_path.name}: {e}")

    action_items = brief.get("action_items") or brief.get("actionItems", [])
    sentiment = brief.get("sentiment", "Neutral")
    tags = brief.get("tags", [])

    # Normalize duration: prefer sidecar duration_sec, else Whisper audio duration.
    dur_sec = parsed.get("duration_sec") or _dur or None

    payload = {
        # ── Identity / contact ──
        "contact_name": contact_name,
        "phone_number": phone,
        "acr_phone_e164": parsed.get("phone_e164") or (norm_phone(phone) if phone else ""),
        "contact_id": contact_id,
        # ── ACR filename + sidecar metadata (maximum extraction) ──
        "acr_pattern":        parsed.get("pattern") or "X",
        "acr_canonical_name": parsed.get("canonical_name") or local_path.name,
        "acr_direction":      parsed.get("direction") or None,
        "acr_channel":        parsed.get("channel") or "phone",
        "acr_confidence":     parsed.get("confidence") or "low",
        "acr_parse_notes":    parsed.get("parse_notes") or "",
        "acr_lat":            parsed.get("lat"),
        "acr_lon":            parsed.get("lon"),
        "acr_address":        parsed.get("address") or "",
        "acr_duration_sec":   float(dur_sec) if dur_sec else None,
        "acr_original_name":  parsed.get("original_name") or local_path.name,
        "acr_sidecar_path":   parsed.get("sidecar_path") or "",
        # ── Transcript + brief ──
        "raw_transcript": transcript,
        "transcript": transcript,
        "transcript_encrypted": transcript_encrypted,
        "transcript_iv": transcript_iv,
        "executive_brief": brief,
        "sentiment": sentiment,
        "tags": tags,
        "status": "completed",
        "recommended_followup_date": brief.get("recommended_followup_date"),
        "draft_followup_message": brief.get("draft_followup_message"),
        "open_commitments": brief.get("open_commitments", []),
        "timestamp": timestamp or datetime.now(timezone.utc).isoformat(),
        "embedding": embedding,
    }

    try:
        db.table("call_records").insert(payload).execute()
    except Exception as e:
        logger.error(f"[SCAN] DB insert failed for {local_path.name}: {e}")
        return {"status": "error", "reason": f"db: {e}"}

    # Mirror to call_recordings archive so dedup/audit is consistent.
    try:
        db.table("call_recordings").upsert(
            {
                "canonical_name": parsed.get("canonical_name") or local_path.name,
                "original_name": local_path.name,
                "md5_hash": md5,
                "status": "COMPLETED",
                "transcript_txt": transcript,
                "transcribed_at": datetime.now(timezone.utc).isoformat(),
                "contact_id": contact_id,
                "pattern": parsed.get("pattern") or "X",
                "channel": parsed.get("channel") or "phone",
                "direction": parsed.get("direction") or None,
                "duration_sec": float(dur_sec) if dur_sec else None,
                "lat": parsed.get("lat"),
                "lon": parsed.get("lon"),
                "address": parsed.get("address") or "",
            },
            on_conflict="md5_hash",
        ).execute()
    except Exception as e:
        logger.warning(f"[SCAN] archive mirror failed (non-blocking) for {local_path.name}: {e}")

    return {"status": "inserted", "contact": contact_name, "md5": md5}


# ─────────────────────────────────────────────────────────────────────────────
# One scan pass over both Drive folders
# ─────────────────────────────────────────────────────────────────────────────
def scan_pass(connector_factory, checkpoint: set) -> dict:
    totals = {"downloaded": 0, "inserted": 0, "skipped": 0, "errors": 0, "files": []}
    from db.supabase_client import get_supabase

    db = get_supabase()
    if not db:
        logger.error("[SCAN] No Supabase client — aborting pass.")
        return totals

    for folder_id, label in ((AUDIO_ARCHIVE_ID, "Audio_Archive"),
                             (ACR_RAW_ID, "ACR_Audio_Raw")):
        try:
            conn = connector_factory(folder_id)
        except Exception as e:
            logger.error(f"[SCAN] Drive connector for {label} failed: {e}")
            continue

        staging = Path(STAGING) / label
        staging.mkdir(parents=True, exist_ok=True)

        for fid, name, _mtime in conn.list_audio():
            if fid in checkpoint:
                continue
            if Path(name).suffix.lower() not in AUDIO_EXT:
                checkpoint.add(fid)
                continue
            try:
                local = conn.download(fid, name)
                if local.stat().st_size > MAX_FILE_BYTES:
                    logger.warning(f"[SCAN] skipping {name}: > {MAX_FILE_BYTES} bytes")
                    checkpoint.add(fid)
                    continue
                # Pull the .properties/.json sidecar too — it holds GPS/address/duration
                # and full_parse() expects it beside the audio (flat or /properties/).
                for sfid, sname in conn.find_sidecar_ids(name):
                    try:
                        conn.download(sfid, sname)
                    except Exception as se:
                        logger.warning(f"[SCAN] sidecar {sname} download failed: {se}")
                totals["downloaded"] += 1
                result = process_local_audio(local, db)
                totals[result["status"]] = totals.get(result["status"], 0) + 1
                totals["files"].append({"name": name, **result})
                # Mark processed regardless of outcome so we don't loop forever on a bad file.
                checkpoint.add(fid)
            except Exception as e:
                logger.error(f"[SCAN] processing {name} failed: {e}")
                totals["errors"] += 1
                checkpoint.add(fid)

        _save_checkpoint(checkpoint)

    return totals


def run_forever():
    from services.drive_connector import DriveConnector
    logging.basicConfig(level=logging.INFO)
    checkpoint = _load_checkpoint()
    logger.info(f"[SCAN] starting; {len(checkpoint)} files already processed")
    while True:
        try:
            totals = scan_pass(lambda fid: DriveConnector(fid, STAGING), checkpoint)
            logger.info(
                f"[SCAN] pass done: downloaded={totals['downloaded']} "
                f"inserted={totals['inserted']} skipped={totals['skipped']} "
                f"errors={totals['errors']}"
            )
        except Exception:
            logger.exception("[SCAN] pass error")
        logger.info(f"[SCAN] sleeping {POLL_SECONDS}s")
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    run_forever()
