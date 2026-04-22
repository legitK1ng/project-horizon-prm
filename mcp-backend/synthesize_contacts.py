import os
import json
import logging
from datetime import datetime, timezone
from dotenv import load_dotenv
from supabase import create_client

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger("ContactSynthesis")

load_dotenv()

# Build absolute path to acrphonebackup.json
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKUP_PATH = os.path.join(BASE_DIR, "services", "acrphonebackup.json")

# Supabase setup
SUPABASE_URL = os.getenv("SUPABASE_URL") or "https://jykucnzotuqingrhufdx.supabase.co"
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    logger.error("Missing Supabase credentials")
    exit(1)

db = create_client(SUPABASE_URL, SUPABASE_KEY)
USER_ID = "8f9bd918-48a2-7da2-2e4d-1de095ad5631"

import os
import json
import logging
import asyncio
import re
from datetime import datetime, timezone
from dotenv import load_dotenv
from supabase import create_client

from services.google_people_service import GooglePeopleService

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger("ContactSynthesis")

load_dotenv()

# Build absolute path to acrphonebackup.json
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKUP_PATH = os.path.join(BASE_DIR, "services", "acrphonebackup.json")

# Supabase setup
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    logger.error("Missing Supabase credentials")
    exit(1)

db = create_client(SUPABASE_URL, SUPABASE_KEY)
USER_ID = "8f9bd918-48a2-7da2-2e4d-1de095ad5631"

def normalize_phone(phone: str) -> str:
    """Strip all non-digits and leading +1 for loose matching."""
    if not phone: return ""
    digits = re.sub(r'\D', '', phone)
    if digits.startswith('1') and len(digits) == 11:
        return digits[1:]
    return digits[-10:] if len(digits) >= 10 else digits

async def run_synthesis():
    logger.info(f"Loading data from {BACKUP_PATH}...")
    if not os.path.exists(BACKUP_PATH):
        logger.error(f"File not found: {BACKUP_PATH}")
        return

    with open(BACKUP_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)

    call_logs = data.get("phoneCallLogs", [])
    tagged = data.get("cbTaggedNumbers", [])
    logger.info(f"Processing {len(call_logs)} call logs and {len(tagged)} tags...")

    # 1. Build Tagged Map
    tagged_map = {}
    for t in tagged:
        p = normalize_phone(t.get("number", ""))
        if p: tagged_map[p] = t.get("name")

    # 2. Fetch Google Contacts for Enrichment
    google_service = GooglePeopleService(db)
    google_contacts = []
    google_phone_map = {}
    
    try:
        logger.info("Fetching contacts from Google People API for enrichment...")
        # Since we are running as a script, we assume the environment variables for OAuth are set
        # sync_contacts returns a dict with 'connections' in it if we modified it, 
        # but let's just get them from the DB if they were synced recently, or trigger a fresh sync.
        sync_result = await google_service.sync_contacts(USER_ID)
        logger.info(f"Google Sync completed: {sync_result.get('total_found')} contacts found.")
        
        # Now fetch them back from the DB to have a clean list
        res = db.table("contacts").select("*").eq("user_id", USER_ID).execute()
        google_contacts = res.data
        for c in google_contacts:
            p = normalize_phone(c.get("phone", ""))
            if p: google_phone_map[p] = c
    except Exception as e:
        logger.warning(f"Google Enrichment failed (proceeding with ACR data): {e}")

    # 3. Extract unique phone numbers from call logs
    unique_phones = {}
    for log in call_logs:
        raw_phone = log.get("cbPhoneNumber")
        if not raw_phone: continue
        
        norm = normalize_phone(raw_phone)
        if not norm: continue

        if norm not in unique_phones:
            # TRY MATCHING STEPS:
            # A. Google Match
            # B. Tagged Match
            # C. Default
            
            match = google_phone_map.get(norm, {})
            tagged_name = tagged_map.get(norm)

            full_name = match.get("full_name") or tagged_name
            if not full_name:
                # Skip unknown phone numbers — do not create placeholder "Contact +phone" entries
                continue

            unique_phones[norm] = {
                "user_id": USER_ID,
                "phone": raw_phone,
                "full_name": full_name,
                "first_name": match.get("first_name", full_name.split()[0]),
                "last_name": match.get("last_name", " ".join(full_name.split()[1:])),
                "email": match.get("email"),
                "photo_url": match.get("photo_url"),
                "google_resource_name": match.get("google_resource_name") or f"synthetic/{norm}",
                "raw_data": match.get("raw_data") or {"source": "acr_backup", "original_phone": raw_phone}
            }

    logger.info(f"Final combined entities to upsert: {len(unique_phones)}")

    to_upsert = list(unique_phones.values())
    
    # Chunked Upsert
    chunk_size = 50
    for i in range(0, len(to_upsert), chunk_size):
        chunk = to_upsert[i:i + chunk_size]
        try:
            db.table("contacts").upsert(chunk, on_conflict="google_resource_name").execute()
            logger.info(f"Synced {min(i + chunk_size, len(to_upsert))}/{len(to_upsert)} entities...")
        except Exception as e:
            logger.error(f"Error upserting chunk: {e}")

    logger.info("Synthesis complete! Now re-running call log to contact mapping...")
    
    from final_data_sync import run_sync
    run_sync()

if __name__ == "__main__":
    asyncio.run(run_synthesis())
