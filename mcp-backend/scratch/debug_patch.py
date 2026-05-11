import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

# Query to get the table definition if possible, or just look at column info
query = """
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM 
    information_schema.columns
WHERE 
    table_name = 'call_records'
ORDER BY 
    ordinal_position;
"""

# PostgREST doesn't support raw SQL queries like this easily via the client.
# We have to use a RPC if one exists, or just use the management API if we had the token.
# But we can try to guess from the error message.

# Let's try to trigger the 400 error manually and see the detail.
try:
    res = supabase.table("call_records").update({"status": "INCOMPLETE"}).eq("id", "af0ac2f7-0689-444f-a032-eccad97b76a2").execute()
    print("Success:", res)
except Exception as e:
    print("Error:", e)
