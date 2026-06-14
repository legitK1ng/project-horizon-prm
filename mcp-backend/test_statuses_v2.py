"""
ARCHIVED — do not run. This script was testing invalid status values against the
live call_records table and caused a burst of constraint violations in Supabase.

call_records.status constraint: ('pending', 'processing', 'completed', 'error')
See docs/API_CONTRACT.md § call_records for the authoritative schema.
"""
raise RuntimeError(
    "Archived test script. Caused DB constraint errors 2026-05-13. "
    "See mcp-backend/core/sentinel.py for correct status values."
)
