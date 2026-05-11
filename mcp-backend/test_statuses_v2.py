import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(url, key)

statuses_to_test = ["queued", "completed", "skipped_short", "error", "incomplete", "failed", "QUEUED", "COMPLETED", "ERROR"]

record_id = "af0ac2f7-0689-444f-a032-eccad97b76a2"

for status in statuses_to_test:
    try:
        res = supabase.table("call_records").update({"status": status}).eq("id", record_id).execute()
        print(f"Status '{status}': Success")
    except Exception as e:
        print(f"Status '{status}': Failed - {e}")
