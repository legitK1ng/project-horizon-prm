
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY")
supabase = create_client(url, key)

def get_constraints():
    statuses = ["QUEUED", "PROCESSING", "COMPLETED", "FAILED", "queued", "processing", "completed", "failed", "error", "pending"]
    res = supabase.table("call_records").select("id").limit(1).execute()
    test_id = res.data[0]["id"]
    for s in statuses:
        try:
            supabase.table("call_records").update({"status": s}).eq("id", test_id).execute()
            print(f"[{s}] - ALLOWED")
        except Exception as e:
            print(f"[{s}] - DENIED")

if __name__ == "__main__":
    get_constraints()
