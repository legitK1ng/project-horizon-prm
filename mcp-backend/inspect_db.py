import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(url, key)

try:
    # Fetch one record and see all keys
    res = supabase.table("call_records").select("*").limit(1).execute()
    if res.data:
        print(f"Columns: {list(res.data[0].keys())}")
        print(f"Sample data: {res.data[0]}")
    else:
        print("No data in call_records")
except Exception as e:
    print(f"Error: {e}")
