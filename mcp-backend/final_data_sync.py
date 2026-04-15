import os
import json
import logging
from datetime import datetime, timezone
from dotenv import load_dotenv
from supabase import create_client

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger("FinalDataSync")

load_dotenv()

# Build absolute path to acrphonebackup.json
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKUP_PATH = os.path.join(BASE_DIR, "services", "acrphonebackup.json")

# Supabase setup (Using robust pathing for .env)
env_path = os.path.join(BASE_DIR, ".env")
load_dotenv(dotenv_path=env_path)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    logger.error(f"Missing Supabase credentials in {env_path}")
    # Fallback to known dev values if env load fails
    SUPABASE_URL = "https://jykucnzotuqingrhufdx.supabase.co"
    SUPABASE_KEY = os.getenv("VITE_SUPABASE_ANON_KEY") or "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5a3VjbnpvdHVxaW5ncmh1ZmR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNzY0NzEsImV4cCI6MjA4NzY1MjQ3MX0.3KMCPpz1SuKw4QTUqDaSHk3IfxIq0oigTYChRKUtLdM"

if not SUPABASE_URL or not SUPABASE_KEY:
    logger.error("Missing Supabase credentials in .env")
    exit(1)

db = create_client(SUPABASE_URL, SUPABASE_KEY)

def format_timestamp(millis):
    """Convert milliseconds to ISO 8601 string."""
    try:
        return datetime.fromtimestamp(millis / 1000, tz=timezone.utc).isoformat()
    except Exception:
        return datetime.now(timezone.utc).isoformat()

def normalize_phone(phone: str) -> str:
    """Strip all non-digits and leading +1 for loose matching."""
    if not phone: return ""
    import re
    digits = re.sub(r'\D', '', phone)
    if digits.startswith('1') and len(digits) == 11:
        return digits[1:]
    return digits[-10:] if len(digits) >= 10 else digits

def run_sync():
    logger.info(f"Loading backup data from {BACKUP_PATH}...")
    
    if not os.path.exists(BACKUP_PATH):
        logger.error(f"File not found: {BACKUP_PATH}")
        return

    with open(BACKUP_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)

    call_logs = data.get("phoneCallLogs", [])
    logger.info(f"Found {len(call_logs)} call logs in backup.")

    # 1. Fetch existing contacts for mapping
    logger.info("Fetching contacts for mapping...")
    contacts_res = db.table("contacts").select("id, phone").execute()
    
    # Build a lookup map of normalized_phone -> contact_id
    contact_map = {}
    for c in contacts_res.data:
        p = c.get("phone")
        if p:
            norm = normalize_phone(p)
            contact_map[norm] = c["id"]
            
    logger.info(f"Mapped {len(contact_map)} unique phones to contact IDs.")

    # 2. Batch prepare call records
    records = []
    for log in call_logs:
        phone = log.get("cbPhoneNumber")
        if not phone:
            continue
            
        norm = normalize_phone(phone)
        target_contact_id = contact_map.get(norm)

        contact_name = log.get("cbContactName") or f"Unknown ({phone})"

        records.append({
            "contact_id": target_contact_id,
            "contact_name": contact_name,
            "phone_number": phone,
            "timestamp": format_timestamp(log.get("logDateInMillis", 0)),
            "duration": str(log.get("durationInSeconds", 0)),
            "status": "completed",
            "external_id": str(log.get("id")),
            "tags": ["imported_from_json"]
        })

    logger.info(f"Prepared {len(records)} records for insertion.")
    if not records:
        logger.warning("No records were prepared. Check input data or path.")
        return

    # 3. Bulk Insert (Chunked)
    chunk_size = 500
    total_inserted = 0
    for i in range(0, len(records), chunk_size):
        chunk = records[i:i + chunk_size]
        try:
            logger.info(f"Upserting chunk {i//chunk_size + 1}...")
            res = db.table("call_records").upsert(chunk, on_conflict="external_id").execute()
            total_inserted += len(chunk)
            logger.info(f"Inserted/Updated {total_inserted}/{len(records)} records...")
        except Exception as e:
            logger.error(f"Error inserting chunk: {e}")
            # Try to print more details
            if hasattr(e, 'message'):
                logger.error(f"Error message: {e.message}")

    logger.info("Sync complete!")

if __name__ == "__main__":
    run_sync()
