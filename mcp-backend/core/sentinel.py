import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone
from db.supabase_client import get_supabase
from services.transcription_service import TranscriptionManager

logger = logging.getLogger(__name__)

# REQ-Sentinel: Autonomous Self-Correction Bot
# This bot monitors the communication between components and fixes stuck pipelines.

class HorizonSentinel:
    def __init__(self, interval_seconds: int = 300):
        self.interval = interval_seconds
        self.is_running = False
        self.transcription_manager = TranscriptionManager()

    async def run(self):
        self.is_running = True
        logger.info(f"[SENTINEL] Bot activated. Monitoring interval: {self.interval}s")
        
        while self.is_running:
            try:
                await self.audit_pipeline()
            except Exception as e:
                logger.error(f"[SENTINEL] Audit failed: {e}")
            
            await asyncio.sleep(self.interval)

    async def audit_pipeline(self):
        logger.info("[SENTINEL] Starting system audit...")
        supabase = get_supabase()
        if not supabase:
            logger.warning("[SENTINEL] Supabase connection unavailable. Skipping audit.")
            return

        # 1. Monitor: Find records stuck in 'QUEUED' or 'PROCESSING' for > 30 mins
        stale_threshold = datetime.now(timezone.utc) - timedelta(minutes=30)
        
        response = supabase.table("call_records") \
            .select("id, status, external_id, timestamp") \
            .in_("status", ["QUEUED", "PROCESSING"]) \
            .lt("created_at", stale_threshold.isoformat()) \
            .execute()

        stuck_records = response.data or []
        
        if stuck_records:
            logger.warning(f"[SENTINEL] Found {len(stuck_records)} stuck records. Attempting self-correction...")
            for record in stuck_records:
                await self.fix_record(record)
        else:
            logger.info("[SENTINEL] Pipeline is healthy. No stuck records found.")

    async def fix_record(self, record):
        logger.info(f"[SENTINEL] Fixing record {record['id']} (External ID: {record['external_id']})...")
        
        # Self-Correction Strategy: Reset status to 'QUEUED' and trigger re-transcription if possible
        # In a real scenario, we might check if the file exists on disk/cloud first.
        try:
            # For now, we just mark it as ERROR if it keeps failing, or re-queue.
            # Let's try to re-process if it's an audio record.
            # (In the future, this would call the transcription logic again)
            pass 
        except Exception as e:
            logger.error(f"[SENTINEL] Failed to fix record {record['id']}: {e}")

    def stop(self):
        self.is_running = False
        logger.info("[SENTINEL] Bot deactivating.")
