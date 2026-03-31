"""
AGENT-5: Supabase Schema Migration
Applies the HORIZON PRM schema (schema.sql) to the live Supabase instance.
REQs: REQ-015, REQ-018, REQ-019, REQ-020, REQ-021, REQ-023
"""
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ["SUPABASE_KEY"]

from supabase import create_client

print(f"[AGENT-5] Connecting to Supabase: {SUPABASE_URL}")
db = create_client(SUPABASE_URL, SUPABASE_KEY)

# -- Create tables via Supabase RPC (execute raw SQL)
# We use individual CREATE TABLE IF NOT EXISTS statements for idempotency

MIGRATIONS = [
    ("organizations", """
        CREATE TABLE IF NOT EXISTS organizations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL,
            industry TEXT,
            headcount_range TEXT,
            funding_stage TEXT,
            website TEXT,
            enrichment_record_id UUID,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    """),
    ("contacts", """
        CREATE TABLE IF NOT EXISTS contacts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL,
            phone TEXT,
            email TEXT,
            organization_id UUID,
            notes TEXT,
            tags TEXT[] DEFAULT '{}',
            health_score NUMERIC(5,2) DEFAULT 0,
            last_contact_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    """),
    ("entities", """
        CREATE TABLE IF NOT EXISTS entities (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
            field_type TEXT NOT NULL,
            value TEXT NOT NULL,
            confidence NUMERIC(3,2),
            source TEXT NOT NULL,
            fetched_at TIMESTAMPTZ NOT NULL,
            override_by TEXT,
            override_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    """),
    ("relationships", """
        CREATE TABLE IF NOT EXISTS relationships (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            entity_id_a UUID REFERENCES contacts(id) ON DELETE CASCADE,
            entity_id_b UUID REFERENCES contacts(id) ON DELETE CASCADE,
            relationship_type TEXT,
            weight NUMERIC(5,2) DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    """),
    ("touchpoints", """
        CREATE TABLE IF NOT EXISTS touchpoints (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
            channel TEXT,
            reference_id UUID,
            summary TEXT,
            sentiment TEXT,
            occurred_at TIMESTAMPTZ NOT NULL,
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    """),
    ("enrichment_jobs", """
        CREATE TABLE IF NOT EXISTS enrichment_jobs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
            stage INTEGER,
            status TEXT DEFAULT 'PENDING',
            attempts INTEGER DEFAULT 0,
            result_json JSONB,
            source_name TEXT,
            confidence TEXT,
            fetched_at TIMESTAMPTZ,
            error_message TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    """),
    ("social_signals", """
        CREATE TABLE IF NOT EXISTS social_signals (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
            platform TEXT,
            signal_type TEXT,
            content TEXT,
            source_url TEXT,
            gemini_reply_suggestion TEXT,
            occurred_at TIMESTAMPTZ NOT NULL,
            classified_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    """),
    ("user_encryption_keys", """
        CREATE TABLE IF NOT EXISTS user_encryption_keys (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL UNIQUE,
            key_reference TEXT NOT NULL,
            algorithm TEXT DEFAULT 'AES-256-GCM',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            rotated_at TIMESTAMPTZ
        );
    """),
]

print("\n[AGENT-5] Running schema migrations...\n")
passed = []
failed = []

for table_name, sql in MIGRATIONS:
    try:
        # Supabase Python client doesn't expose raw SQL directly on the free tier
        # via .rpc() without a stored procedure. We use postgrest-py workaround:
        result = db.rpc("exec_sql", {"sql": sql}).execute()
        print(f"  ✅ {table_name}")
        passed.append(table_name)
    except Exception as e:
        err = str(e)
        # If table already exists, that's fine
        if "already exists" in err or "42P07" in err:
            print(f"  ✓  {table_name} (already exists — skipped)")
            passed.append(table_name)
        else:
            print(f"  ❌ {table_name}: {err}")
            failed.append((table_name, err))

print(f"\n[AGENT-5] Migration complete: {len(passed)} passed, {len(failed)} failed")

# Verify by listing existing tables via Supabase
print("\n[AGENT-5] Verifying call_records table (pre-existing)...")
try:
    resp = db.table("call_records").select("id").limit(1).execute()
    print(f"  ✅ call_records accessible — {len(resp.data)} rows sampled")
except Exception as e:
    print(f"  ❌ call_records: {e}")

if failed:
    print("\n[AGENT-5] CHECKPOINT: Some migrations failed. Review errors above.")
    sys.exit(1)
else:
    print("\n[AGENT-5] CHECKPOINT: All migrations passed. Schema ready.")
    sys.exit(0)
