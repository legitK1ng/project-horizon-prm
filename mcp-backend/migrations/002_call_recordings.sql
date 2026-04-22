-- ============================================================
-- Horizon PRM — Migration 002
-- Purpose: call_recordings table for ACR batch ingestion pipeline
-- Richer than call_records: includes parsed metadata, sidecar
-- data (GPS/address), MD5 dedup, and transcription fields.
-- Run via: psql $DATABASE_URL -f migrations/002_call_recordings.sql
-- Or apply through Supabase Dashboard → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS call_recordings (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    canonical_name   TEXT        UNIQUE NOT NULL,
    original_name    TEXT,
    original_path    TEXT,

    -- Parsed from filename
    pattern          TEXT,                               -- A/B/C/D/E/F/G/H/I/J/K/X
    contact_name     TEXT,
    phone_e164       TEXT,
    direction        TEXT        CHECK (direction IN ('OUT', 'IN', 'FB', 'ZOOM', 'MIC', 'UNK', '')),
    channel          TEXT        CHECK (channel   IN ('phone', 'facebook', 'zoom', 'mic')),
    datetime_str     TEXT,                               -- 2025-08-09_173410
    call_timestamp   TIMESTAMPTZ,
    ch_idx           TEXT        DEFAULT '',             -- '' / '0' / '1'
    confidence       TEXT        CHECK (confidence IN ('high', 'medium', 'low')),
    parse_notes      TEXT,

    -- Sidecar metadata (.properties / .json companion files)
    sidecar_path     TEXT,
    duration_ms      INTEGER,
    duration_sec     NUMERIC(10,1),
    lat              NUMERIC(11,8),
    lon              NUMERIC(11,8),
    address          TEXT,

    -- File info
    size_bytes       BIGINT,
    mtime            TIMESTAMPTZ,
    md5_hash         TEXT        UNIQUE,

    -- Transcription (populated by transcription pipeline)
    transcript_txt   TEXT,
    transcript_srt   TEXT,
    whisper_model    TEXT,
    transcribed_at   TIMESTAMPTZ,

    -- PRM enrichment (populated after transcription)
    contact_id       UUID        REFERENCES contacts(id) ON DELETE SET NULL,
    executive_brief  JSONB,
    sentiment        TEXT,
    tags             TEXT[],
    summary          TEXT,
    recommended_followup_date DATE,
    open_commitments JSONB,

    -- Ingest status
    status           TEXT        DEFAULT 'QUEUED'
                                 CHECK (status IN ('QUEUED', 'TRANSCRIBING', 'COMPLETED', 'SKIPPED_SHORT', 'DUPLICATE', 'ERROR')),
    error_detail     TEXT,

    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_recordings_phone        ON call_recordings (phone_e164);
CREATE INDEX IF NOT EXISTS idx_call_recordings_timestamp    ON call_recordings (call_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_call_recordings_contact_name ON call_recordings (contact_name);
CREATE INDEX IF NOT EXISTS idx_call_recordings_md5          ON call_recordings (md5_hash);
CREATE INDEX IF NOT EXISTS idx_call_recordings_contact_id   ON call_recordings (contact_id);
CREATE INDEX IF NOT EXISTS idx_call_recordings_status       ON call_recordings (status);
