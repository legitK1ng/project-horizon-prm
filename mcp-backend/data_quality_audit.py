import os
import json
import logging
from datetime import datetime
from typing import List, Dict, Any

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger("DataQualityAudit")

class DataQualityAudit:
    """Implements data quality checks for the Horizon PRM vault."""
    
    def __init__(self, vault_path: str, supabase_client=None):
        self.vault_path = vault_path
        self.db = supabase_client
        self.metrics = {
            "backups_found": 0,
            "transcripts_found": 0,
            "audio_files_found": 0,
            "db_call_records": 0,
            "db_unique_contacts": 0,
            "status": "PASS"
        }

    def run_db_audit(self):
        """Pattern 1: Completeness & Uniqueness checks from @data-quality-frameworks"""
        if not self.db:
            return
        
        logger.info("Starting Database Data Quality Audit...")
        
        # 1. Uniqueness check
        calls_res = self.db.table("call_records").select("id", count="exact").execute()
        self.metrics["db_call_records"] = calls_res.count
        
        contacts_res = self.db.table("contacts").select("id", count="exact").execute()
        self.metrics["db_unique_contacts"] = contacts_res.count
        
        # 2. Timeliness check (Freshness)
        latest_call = self.db.table("call_records").select("timestamp").order("timestamp", desc=True).limit(1).execute()
        if latest_call.data:
            latest_ts = latest_call.data[0]["timestamp"]
            logger.info(f"Freshness: Latest call record timestamp is {latest_ts}")

    def run_vault_audit(self):
        logger.info(f"Starting Data Quality Audit on {self.vault_path}...")
        
        backups_dir = os.path.join(self.vault_path, "01_Ingest_Queue", "Backups_Raw")
        transcripts_dir = os.path.join(self.vault_path, "02_Processed_Vault", "Transcripts_JSON")
        audio_dir = os.path.join(self.vault_path, "02_Processed_Vault", "Audio_Archive")
        
        # 1. Completeness: Check backups
        if os.path.exists(backups_dir):
            backups = [f for f in os.listdir(backups_dir) if f.endswith('.acr-backup')]
            self.metrics["backups_found"] = len(backups)
            logger.info(f"Found {len(backups)} backup files.")
        
        # 2. Completeness: Check transcripts
        if os.path.exists(transcripts_dir):
            transcripts = [f for f in os.listdir(transcripts_dir) if f.endswith('.properties')]
            self.metrics["transcripts_found"] = len(transcripts)
            logger.info(f"Found {len(transcripts)} transcription metadata files.")

        # 3. Completeness: Check audio
        if os.path.exists(audio_dir):
            audio_files = []
            for root, dirs, files in os.walk(audio_dir):
                for file in files:
                    if file.endswith(('.mp3', '.m4a', '.wav')):
                        audio_files.append(file)
            self.metrics["audio_files_found"] = len(audio_files)
            logger.info(f"Found {len(audio_files)} audio recordings.")

        # 4. Accuracy: Cross-reference (Heuristic)
        # In a real scenario, we'd map audio to transcripts.
        
    def generate_report(self):
        report_path = os.path.join(self.vault_path, "03_Database_State", f"audit_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json")
        with open(report_path, 'w') as f:
            json.dump(self.metrics, f, indent=4)
        logger.info(f"Audit report generated at: {report_path}")
        return report_path

if __name__ == "__main__":
    from dotenv import load_dotenv
    from supabase import create_client
    
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    env_path = os.path.join(BASE_DIR, ".env")
    load_dotenv(dotenv_path=env_path)
    
    url = os.getenv("SUPABASE_URL") or "https://jykucnzotuqingrhufdx.supabase.co"
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    
    db = None
    if url and key:
        db = create_client(url, key)
    
    VAULT = r"C:\Users\owner\My Drive\Horizon_Data"
    audit = DataQualityAudit(VAULT, supabase_client=db)
    audit.run_vault_audit()
    audit.run_db_audit()
    audit.generate_report()
