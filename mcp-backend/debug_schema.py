import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

db = create_client(SUPABASE_URL, SUPABASE_KEY)

print(f"Checking schema for 'call_records'...")
try:
    # Get one row to see columns
    res = db.table("call_records").select("*").limit(1).execute()
    if res.data:
        print("Columns found:")
        for key in res.data[0].keys():
            print(f"  - {key}")
    else:
        print("No data in call_records, trying to get column names from information_schema...")
        sql = "SELECT column_name FROM information_schema.columns WHERE table_name = 'call_records';"
        res = db.rpc("exec_sql", {"sql": sql}).execute()
        print("Columns:", res.data)
except Exception as e:
    print(f"Error: {e}")
