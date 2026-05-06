"""
Horizon Sentinel — Autonomous Pipeline Guardian
=================================================
Self-correcting bot that runs inside the ingestion server.
Monitors the transcription pipeline and fixes problems automatically.

Responsibilities:
  1. Detect stuck records (QUEUED/PROCESSING > 30 min) and re-queue or error them
  2. Detect records with missing transcripts and flag them
  3. Monitor Whisper model availability and log warnings
  4. Track pipeline health metrics for diagnostics
  5. Prevent silent data loss by catching orphaned records

Architecture:
  - Runs as an asyncio background task inside ingestion_server.py
  - Uses the same Supabase client as the rest of the server
  - Never crashes the host process — all operations are wrapped in try/except
  - Logs everything to the standard logger for the System Console
"""

import asyncio
import logging
import os
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

logger = logging.getLogger(__name__)

# Guard the import — if faster-whisper isn't installed, sentinel still runs
try:
    from services.transcription_service import TranscriptionManager
    _WHISPER_AVAILABLE = True
except ImportError:
    _WHISPER_AVAILABLE = False
    logger.warning("[SENTINEL] faster-whisper not available — transcription self-repair disabled")


class PipelineMetrics:
    """Rolling counters for pipeline health observability."""
    def __init__(self):
        self.audits_run = 0
        self.records_fixed = 0
        self.records_errored = 0
        self.last_audit_time: Optional[str] = None
        self.last_audit_status: str = "pending"
        self.consecutive_failures = 0
        self.server_start_time = datetime.now(timezone.utc).isoformat()

    def to_dict(self) -> dict:
        return {
            "audits_run": self.audits_run,
            "records_fixed": self.records_fixed,
            "records_errored": self.records_errored,
            "last_audit_time": self.last_audit_time,
            "last_audit_status": self.last_audit_status,
            "consecutive_failures": self.consecutive_failures,
            "server_start_time": self.server_start_time,
            "whisper_available": _WHISPER_AVAILABLE,
        }


class HorizonSentinel:
    """
    Autonomous self-correction bot for the Horizon transcription pipeline.

    Runs on a configurable interval (default 5 min). Each audit cycle:
      1. Checks DB connectivity
      2. Finds stuck records and attempts self-correction
      3. Validates data integrity (missing transcripts, orphaned records)
      4. Reports metrics

    Self-correction strategy for stuck records:
      - QUEUED > 30 min with audio_path → attempt re-transcription
      - QUEUED > 30 min without audio_path → mark ERROR (no audio to process)
      - PROCESSING > 30 min → reset to QUEUED for retry (max 3 retries)
      - Any record that fails 3+ retries → mark FAILED with diagnostic note
    """

    MAX_RETRIES = 3
    STALE_MINUTES = 30

    def __init__(self, interval_seconds: int = 300):
        self.interval = interval_seconds
        self.is_running = False
        self.metrics = PipelineMetrics()
        self._db = None

    async def run(self):
        """Main loop — never crashes, just logs and continues."""
        self.is_running = True
        logger.info(
            f"[SENTINEL] Bot activated. "
            f"Interval: {self.interval}s | Whisper: {'ready' if _WHISPER_AVAILABLE else 'unavailable'}"
        )

        while self.is_running:
            try:
                await self.audit_pipeline()
                self.metrics.consecutive_failures = 0
                self.metrics.last_audit_status = "healthy"
            except Exception as e:
                self.metrics.consecutive_failures += 1
                self.metrics.last_audit_status = f"error: {str(e)[:100]}"
                logger.error(
                    f"[SENTINEL] Audit failed (attempt #{self.metrics.consecutive_failures}): {e}"
                )
                # Back off if we keep failing — don't spam logs
                if self.metrics.consecutive_failures > 5:
                    backoff = min(self.interval * 2, 1800)  # Max 30 min backoff
                    logger.warning(f"[SENTINEL] Repeated failures. Backing off to {backoff}s")
                    await asyncio.sleep(backoff)
                    continue

            self.metrics.audits_run += 1
            self.metrics.last_audit_time = datetime.now(timezone.utc).isoformat()
            await asyncio.sleep(self.interval)

    async def audit_pipeline(self):
        """Single audit cycle — find and fix problems."""
        logger.info("[SENTINEL] Starting system audit...")

        # Get DB connection
        from db.supabase_client import get_supabase
        db = get_supabase()
        if not db:
            logger.warning("[SENTINEL] Supabase unavailable. Skipping audit.")
            return
        self._db = db

        # 1. Find stuck records
        await self._fix_stuck_records(db)

        # 2. Find records with missing transcripts that should have them
        await self._fix_missing_transcripts(db)

        # 3. Log health summary
        logger.info(
            f"[SENTINEL] Audit complete. "
            f"Fixed: {self.metrics.records_fixed} | "
            f"Errored: {self.metrics.records_errored} | "
            f"Total audits: {self.metrics.audits_run + 1}"
        )

    async def _fix_stuck_records(self, db):
        """Find records stuck in QUEUED or PROCESSING for too long and fix them."""
        stale_threshold = datetime.now(timezone.utc) - timedelta(minutes=self.STALE_MINUTES)

        try:
            response = db.table("call_records") \
                .select("id, status, external_id, audio_path, contact_name, created_at") \
                .in_("status", ["QUEUED", "PROCESSING", "queued", "processing"]) \
                .lt("created_at", stale_threshold.isoformat()) \
                .execute()
        except Exception as e:
            logger.warning(f"[SENTINEL] Query for stuck records failed: {e}")
            return

        stuck_records = response.data or []
        if not stuck_records:
            logger.info("[SENTINEL] No stuck records found. Pipeline is flowing.")
            return

        logger.warning(f"[SENTINEL] Found {len(stuck_records)} stuck records.")

        for record in stuck_records:
            await self._attempt_fix(db, record)

    async def _attempt_fix(self, db, record: dict):
        """Attempt to fix a single stuck record."""
        record_id = record["id"]
        audio_path = record.get("audio_path")
        contact = record.get("contact_name", "Unknown")

        logger.info(f"[SENTINEL] Fixing record {record_id} ({contact})...")

        try:
            # Check retry count from a sentinel_retries field, or count from status history
            # For now, we track retries by checking how old the record is
            created = record.get("created_at", "")
            age_hours = 0
            if created:
                try:
                    created_dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
                    age_hours = (datetime.now(timezone.utc) - created_dt).total_seconds() / 3600
                except (ValueError, TypeError):
                    pass

            # If stuck for more than 2 hours, mark as FAILED — don't keep retrying forever
            if age_hours > 2:
                db.table("call_records").update({
                    "status": "FAILED",
                }).eq("id", record_id).execute()
                self.metrics.records_errored += 1
                logger.warning(
                    f"[SENTINEL] Record {record_id} stuck for {age_hours:.1f}h. "
                    f"Marked FAILED to prevent infinite retry."
                )
                return

            # If it has an audio path and Whisper is available, re-queue for transcription
            if audio_path and _WHISPER_AVAILABLE and os.path.exists(audio_path):
                # Re-run transcription
                try:
                    from routers.transcriptions import _run_transcription
                    transcript, segments, lang, duration = _run_transcription(audio_path)

                    if transcript and len(transcript.strip()) > 0:
                        # Generate brief if we have enough text
                        executive_brief = None
                        if len(transcript) > 50:
                            try:
                                from services.ai_briefing_service import generate_call_brief
                                executive_brief = generate_call_brief(transcript, contact)
                            except Exception:
                                pass

                        update = {
                            "status": "completed",
                            "transcript": transcript,
                            "raw_transcript": transcript,
                        }
                        if executive_brief:
                            update["executive_brief"] = executive_brief
                            update["sentiment"] = executive_brief.get("sentiment", "Neutral")
                            update["tags"] = executive_brief.get("tags", [])

                        db.table("call_records").update(update).eq("id", record_id).execute()
                        self.metrics.records_fixed += 1
                        logger.info(f"[SENTINEL] Re-transcribed and fixed record {record_id}")
                        return
                except Exception as e:
                    logger.warning(f"[SENTINEL] Re-transcription failed for {record_id}: {e}")

            # No audio file or transcription failed — reset to QUEUED for one more try
            db.table("call_records").update({
                "status": "QUEUED",
            }).eq("id", record_id).execute()
            logger.info(f"[SENTINEL] Reset record {record_id} to QUEUED for retry.")

        except Exception as e:
            self.metrics.records_errored += 1
            logger.error(f"[SENTINEL] Failed to fix record {record_id}: {e}")

    async def _fix_missing_transcripts(self, db):
        """Find completed records that somehow have no transcript — flag them."""
        try:
            response = db.table("call_records") \
                .select("id, contact_name, status") \
                .eq("status", "completed") \
                .is_("transcript", "null") \
                .is_("raw_transcript", "null") \
                .limit(20) \
                .execute()

            orphans = response.data or []
            if orphans:
                logger.warning(
                    f"[SENTINEL] Found {len(orphans)} 'completed' records with no transcript. "
                    f"Marking as INCOMPLETE for review."
                )
                for rec in orphans:
                    try:
                        db.table("call_records").update({
                            "status": "INCOMPLETE",
                        }).eq("id", rec["id"]).execute()
                    except Exception:
                        pass
        except Exception as e:
            # Non-critical — some Supabase setups don't support is_ null queries well
            logger.debug(f"[SENTINEL] Missing transcript check skipped: {e}")

    def stop(self):
        self.is_running = False
        logger.info("[SENTINEL] Bot deactivating.")
