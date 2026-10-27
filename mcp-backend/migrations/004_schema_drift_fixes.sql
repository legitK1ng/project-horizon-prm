-- 004_schema_drift_fixes.sql
-- Idempotent schema reconciliation based on SYNTHESIS_REVIEWS_AND_TODOS.md
-- Fixes schema drift between application models, field-level encryption, and Supabase tables.
--
-- NOTE: Do NOT execute against live Supabase without explicit user confirmation.

-- 1. Ensure encryption and integrity columns exist in call_records
ALTER TABLE call_records ADD COLUMN IF NOT EXISTS transcript_encrypted TEXT;
ALTER TABLE call_records ADD COLUMN IF NOT EXISTS transcript_iv        TEXT;
ALTER TABLE call_records ADD COLUMN IF NOT EXISTS contact_id           UUID REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE call_records ADD COLUMN IF NOT EXISTS acr_direction        TEXT;
ALTER TABLE call_records ADD COLUMN IF NOT EXISTS acr_channel          TEXT DEFAULT 'phone';

-- 2. Ensure tasks / action items table supports linking back to calls and attribution sources
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS related_call_id UUID REFERENCES call_records(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source          TEXT DEFAULT 'manual';

-- 3. Indexes for relational integrity and lookups
CREATE INDEX IF NOT EXISTS idx_call_records_contact_id     ON call_records (contact_id);
CREATE INDEX IF NOT EXISTS idx_tasks_related_call_id       ON tasks (related_call_id);
CREATE INDEX IF NOT EXISTS idx_tasks_source                ON tasks (source);
