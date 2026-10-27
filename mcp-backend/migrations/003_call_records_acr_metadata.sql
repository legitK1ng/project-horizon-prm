-- 003_call_records_acr_metadata.sql
-- Extend call_records with the full ACR filename/sidecar metadata so the
-- vault scanner can surface MAXIMUM meaningful metadata to the user
-- (location, duration, parse confidence, canonical name, etc.).
--
-- Additive + idempotent: safe to re-run against the live DB.
-- Mirrors the recommended call_recordings schema in
-- services/acr_parser_reference.py.

ALTER TABLE call_records ADD COLUMN IF NOT EXISTS acr_pattern       TEXT;
ALTER TABLE call_records ADD COLUMN IF NOT EXISTS acr_canonical_name TEXT;
ALTER TABLE call_records ADD COLUMN IF NOT EXISTS acr_confidence     TEXT;
ALTER TABLE call_records ADD COLUMN IF NOT EXISTS acr_parse_notes    TEXT;
ALTER TABLE call_records ADD COLUMN IF NOT EXISTS acr_phone_e164     TEXT;
ALTER TABLE call_records ADD COLUMN IF NOT EXISTS acr_lat            DOUBLE PRECISION;
ALTER TABLE call_records ADD COLUMN IF NOT EXISTS acr_lon            DOUBLE PRECISION;
ALTER TABLE call_records ADD COLUMN IF NOT EXISTS acr_address        TEXT;
ALTER TABLE call_records ADD COLUMN IF NOT EXISTS acr_duration_sec   NUMERIC(10,1);
ALTER TABLE call_records ADD COLUMN IF NOT EXISTS acr_original_name  TEXT;
ALTER TABLE call_records ADD COLUMN IF NOT EXISTS acr_sidecar_path   TEXT;

-- Helpful indexes (also idempotent-ish; CREATE INDEX IF NOT EXISTS requires PG 9.5+)
CREATE INDEX IF NOT EXISTS idx_call_records_acr_pattern     ON call_records (acr_pattern);
CREATE INDEX IF NOT EXISTS idx_call_records_acr_phone_e164  ON call_records (acr_phone_e164);
CREATE INDEX IF NOT EXISTS idx_call_records_acr_lat         ON call_records (acr_lat);
