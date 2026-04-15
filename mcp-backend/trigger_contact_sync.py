import asyncio
import os
import logging
from dotenv import load_dotenv
from supabase import create_client
from services.google_people_service import GooglePeopleService

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger("ContactSyncTrigger")

load_dotenv()

# Supabase setup
SUPABASE_URL = os.getenv("SUPABASE_URL") or "https://jykucnzotuqingrhufdx.supabase.co"
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    logger.error("Missing Supabase credentials")
    exit(1)

db = create_client(SUPABASE_URL, SUPABASE_KEY)
USER_ID = "8f9bd918-48a2-7da2-2e4d-1de095ad5631"

async def run_sync():
    logger.info(f"Starting full contact sync for user {USER_ID}...")
    sync_service = GooglePeopleService(db)
    try:
        # This will use the refresh token from the DB automatically
        result = await sync_service.sync_contacts(user_id=USER_ID)
        logger.info(f"Sync complete! Result: {result}")
    except Exception as e:
        logger.error(f"Sync failed: {e}")

if __name__ == "__main__":
    asyncio.run(run_sync())
