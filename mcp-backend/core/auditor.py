import os
import logging
from datetime import datetime, timezone
from dotenv import load_dotenv

# Load env from mcp-backend/.env
dotenv_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(dotenv_path)

from db.supabase_client import get_supabase, init_supabase

logger = logging.getLogger(__name__)

# REQ-Auditor: Structural Integrity Specialist
# Reports on the communication health between Horizon components.

class SystemAuditor:
    def __init__(self):
        try:
            init_supabase()
        except:
            pass
        self.supabase = get_supabase()

    def generate_report(self):
        print(f"\n{'='*60}")
        print(f" HORIZON PRM - SYSTEM INTEGRITY REPORT")
        print(f" Generated: {datetime.now(timezone.utc).isoformat()}")
        print(f"{'='*60}\n")

        self.audit_database()
        self.audit_ingestion()
        self.audit_environment()
        
        print(f"\n{'='*60}")
        print(f" AUDIT COMPLETE - All components observed.")
        print(f"{'='*60}\n")

    def audit_database(self):
        print("[DATABASE] Auditing Supabase Connectivity...")
        if not self.supabase:
            print("  [!] FAIL: Supabase client not initialized.")
            return

        try:
            # Check row counts for core tables
            contacts_count = self.supabase.table("contacts").select("id", count="exact").limit(0).execute().count
            calls_count = self.supabase.table("call_records").select("id", count="exact").limit(0).execute().count
            
            print(f"  [+] SUCCESS: Connection active.")
            print(f"  [+] Contacts: {contacts_count}")
            print(f"  [+] Call Records: {calls_count}")
        except Exception as e:
            print(f"  [!] FAIL: Database query failed: {e}")

    def audit_ingestion(self):
        print("[INGESTION] Auditing Pipeline Status...")
        try:
            # Check for queued vs completed records
            queued = self.supabase.table("call_records").select("id").eq("status", "QUEUED").execute().data or []
            processing = self.supabase.table("call_records").select("id").eq("status", "PROCESSING").execute().data or []
            errors = self.supabase.table("call_records").select("id").eq("status", "ERROR").execute().data or []
            
            print(f"  [+] Queued: {len(queued)}")
            print(f"  [+] Processing: {len(processing)}")
            print(f"  [+] Failed (Errors): {len(errors)}")
            
            if len(errors) > 5:
                print("  [!] WARNING: High error rate detected in transcription pipeline.")
        except Exception as e:
            print(f"  [!] FAIL: Ingestion audit failed: {e}")

    def audit_environment(self):
        print("[ENVIRONMENT] Checking Backend Configuration...")
        required_vars = ["SUPABASE_URL", "SUPABASE_KEY", "HORIZON_API_KEY", "OPENAI_API_KEY"]
        for var in required_vars:
            val = os.environ.get(var)
            if val:
                print(f"  [+] {var}: LOADED (Prefix: {val[:4]}...)")
            else:
                print(f"  [!] {var}: MISSING")

if __name__ == "__main__":
    auditor = SystemAuditor()
    auditor.generate_report()
