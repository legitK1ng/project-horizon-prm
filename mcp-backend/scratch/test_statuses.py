
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY")
supabase = create_client(url, key)

def inspect_table():
    # We can't directly query pg_catalog easily via the client if RLS or permissions are tight,
    # but we can try to fetch a record and see its structure, 
    # or try to run a raw RPC if available.
    # Alternatively, we can try to trigger errors with different statuses to map the allowed values.
    
    statuses = ["QUEUED", "PROCESSING", "COMPLETED", "FAILED", "INCOMPLETE", "completed", "failed"]
    print("Testing allowed statuses...")
    for s in statuses:
        try:
            # Try to update a non-existent record just to see if the constraint triggers on value validation
            # Actually, better to use an existing ID if possible to be sure.
            # Let's find one first.
            res = supabase.table("call_records").select("id").limit(1).execute()
            if res.data:
                test_id = res.data[0]["id"]
                res_upd = supabase.table("call_records").update({"status": s}).eq("id", test_id).execute()
                print(f"Status '{s}': SUCCESS")
            else:
                print("No records found in call_records to test with.")
                break
        except Exception as e:
            print(f"Status '{s}': FAILED - {e}")

if __name__ == "__main__":
    inspect_table()
