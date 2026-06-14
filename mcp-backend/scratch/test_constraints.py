"""
ARCHIVED — do not run. This script was inserting rows with invalid status values
into call_records (QUEUED, COMPLETED, FAILED, etc.) which violated the check
constraint. The error burst in Supabase logs 2026-05-13 traces back here.

Valid call_records.status values: 'pending', 'processing', 'completed', 'error'
"""
raise RuntimeError("Archived — see comment above.")
