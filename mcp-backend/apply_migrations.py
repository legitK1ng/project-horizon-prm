import urllib.request
import json
import ssl

ref = "jykucnzotuqingrhufdx"
token = "sbp_42ca2d187317f8ba04f4e47eaa5c33a04335557e"
url = f"https://api.supabase.com/v1/projects/{ref}/database/query"
sql = """
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS entities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), 
    name TEXT NOT NULL, 
    type TEXT CHECK (type IN ('person', 'organization')) NOT NULL, 
    contact_info JSONB, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), 
    entity_id UUID REFERENCES entities(id) ON DELETE CASCADE, 
    relationship_type TEXT NOT NULL, 
    health_score INTEGER CHECK (health_score >= 0 AND health_score <= 100), 
    notes TEXT, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS touchpoints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), 
    entity_id UUID REFERENCES entities(id) ON DELETE CASCADE, 
    interaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(), 
    channel TEXT NOT NULL, 
    summary TEXT, 
    action_items JSONB
);

-- Check what tables we have now
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
"""
headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
}
data = json.dumps({"query": sql}).encode('utf-8')
req = urllib.request.Request(url, data=data, headers=headers, method="POST")
context = ssl.create_default_context()
try:
    with urllib.request.urlopen(req, context=context) as response:
        print("Success!")
        print(response.read().decode())
except Exception as e:
    print("Error:", e)
    if hasattr(e, 'read'):
        print(e.read().decode())
