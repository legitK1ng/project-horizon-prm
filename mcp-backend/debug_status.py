import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(url, key)

# Try to get table info using SQL if possible, or just try to update a dummy record
try:
    # This is a hacky way to see what's allowed by trying something wrong
    res = supabase.table("call_records").update({"status": "INCOMPLETE"}).eq("id", "00000000-0000-0000-0000-000000000000").execute()
    print("Update attempted.")
except Exception as e:
    print(f"Error during update: {e}")

# Try to fetch one record to see status values
res = supabase.table("call_records").select("status").limit(10).execute()
print(f"Sample statuses: {[r['status'] for r in res.data] if res.data else 'No data'}")
