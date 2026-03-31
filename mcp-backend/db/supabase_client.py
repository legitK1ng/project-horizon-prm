"""
DB Client — AGENT-3a | REQ-015, REQ-017
Supabase client initialized from environment variables only.
"""
import os
from supabase import create_client, Client

_supabase_instance: Client | None = None


def init_supabase() -> Client | None:
    url = os.environ.get("SUPABASE_URL", "")
    service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    anon_key = os.environ.get("SUPABASE_KEY", "")

    # Prefer Service Role Key for backend operations, fallback to Anon Key
    key = service_role_key or anon_key

    if not url or not key:
        print(f"[DB] WARNING: Missing credentials (URL: {bool(url)}, KEY: {bool(key)}). DB disabled.", flush=True)
        return None

    global _supabase_instance
    try:
        # Client automatically handles apikey and Authorization headers if key is provided (REQ-017)
        _supabase_instance = create_client(url, key)
        auth_type = "SERVICE_ROLE" if service_role_key else "ANON"
        key_preview = f"{key[:5]}...{key[-5:]}" if len(key) > 10 else "***"
        print(f"[DB] Supabase client initialized ({auth_type}). Key: {key_preview}", flush=True)
    except Exception as e:
        print(f"[DB] ERROR: Failed to create client: {str(e)}", flush=True)
        return None
        
    return _supabase_instance


def get_supabase() -> Client:
    if _supabase_instance is None:
        raise RuntimeError("Supabase not initialized. Call init_supabase() first.")
    return _supabase_instance
