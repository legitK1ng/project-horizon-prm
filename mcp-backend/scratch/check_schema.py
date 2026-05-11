import os
from dotenv import load_dotenv
from supabase import create_client

# Load environment variables from the same dir as this script
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(dotenv_path=os.path.join(BASE_DIR, ".env"))

def check_schema():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY")
    if not url or not key:
        print("FAIL: Missing credentials")
        return
    
    try:
        db = create_client(url, key)
        tables = ["contacts", "call_records", "call_recordings", "profiles"]
        
        for table_name in tables:
            print(f"\n--- Table: {table_name} ---")
            try:
                # Try to get one row to see columns
                res = db.table(table_name).select("*").limit(1).execute()
                if hasattr(res, "data") and res.data:
                    columns = list(res.data[0].keys())
                    print(f"Columns: {columns}")
                else:
                    print("Status: Empty (no rows found to infer columns)")
                
                count_res = db.table(table_name).select("id", count="exact").limit(0).execute()
                print(f"Count: {count_res.count}")
            except Exception as e:
                print(f"Error: {e}")
                
    except Exception as e:
        print(f"FAIL to connect: {e}")

if __name__ == "__main__":
    check_schema()
