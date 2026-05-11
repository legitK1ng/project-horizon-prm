import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(url, key)

# Since we don't have direct SQL access through the client usually, we'll just test valid statuses
statuses_to_test = ["QUEUED", "COMPLETED", "SKIPPED_SHORT", "ERROR", "INCOMPLETE", "completed", "FAILED"]

record_id = "af0ac2f7-0689-444f-a032-eccad97b76a2"

for status in statuses_to_test:
    try:
        res = supabase.table("call_records").update({"status": status}).eq("id", record_id).execute()
        print(f"Status '{status}': Success")
        # Revert to original just in case
        supabase.table("call_records").update({"status": "completed"}).eq("id", record_id).execute()
    except Exception as e:
        print(f"Status '{status}': Failed - {e}")
