import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(dotenv_path="mcp-backend/.env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
USER_ID = "8f9bd918-48a2-7da2-2e4d-1de095ad5631"

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Missing credentials")
    exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

test_contact = {
    "user_id": USER_ID,
    "phone": "+19998887777",
    "full_name": "Test Contact",
    "first_name": "Test",
    "last_name": "Contact",
    "google_resource_name": "synthetic/+19998887777"
}

try:
    res = supabase.table("contacts").upsert(test_contact, on_conflict="google_resource_name").execute()
    print("Upsert result:", res)
except Exception as e:
    print("Upsert error:", e)
