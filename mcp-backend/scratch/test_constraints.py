
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY")
supabase = create_client(url, key)

def get_constraints():
    # Attempt to query information_schema if possible via RPC or just trial-and-error
    # Since we are in a browser environment with Supabase, we might have a 'query' RPC?
    # Probably not by default. 
    # Let's try more exhaustive status testing.
    
    statuses = [
        "QUEUED", "PROCESSING", "COMPLETED", "FAILED", "ERROR", 
        "queued", "processing", "completed", "failed", "error",
        "pending", "INCOMPLETE", "incomplete"
    ]
    print("Testing allowed statuses for 'call_records'...")
    res = supabase.table("call_records").select("id").limit(1).execute()
    if not res.data:
        print("No records in call_records")
        return
    
    test_id = res.data[0]["id"]
    for s in statuses:
        try:
            supabase.table("call_records").update({"status": s}).eq("id", test_id).execute()
            print(f"[{s}] - ALLOWED")
        except Exception as e:
            # Parse the error message to see if it lists allowed values
            msg = str(e)
            print(f"[{s}] - DENIED: {msg}")

if __name__ == "__main__":
    get_constraints()
