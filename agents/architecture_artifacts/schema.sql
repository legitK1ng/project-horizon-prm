-- ============================================================
-- HORIZON PRM — MASTER DATABASE SCHEMA
-- AGENT-2 Output | 2026-03-25
-- REQs Covered: REQ-015, REQ-018, REQ-019, REQ-020, REQ-021
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────
-- TABLE: contacts (Core entity)
-- ─────────────────────────────────────────
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  health_score NUMERIC(5,2) DEFAULT 0 CHECK (health_score BETWEEN 0 AND 100),
  last_contact_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- TABLE: organizations (REQ-020)
-- ─────────────────────────────────────────
CREATE TABLE organizations (
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

-- ─────────────────────────────────────────
-- TABLE: call_records (encrypted transcript)
-- ─────────────────────────────────────────
CREATE TABLE call_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  contact_name TEXT,
  phone_number TEXT,
  duration INTEGER,
  transcript_encrypted BYTEA,           -- AES-256-GCM ciphertext (REQ-039)
  transcript_iv TEXT,                   -- Initialization vector for decryption
  executive_brief JSONB,
  status TEXT CHECK (status IN ('QUEUED','COMPLETED','SKIPPED_SHORT','ERROR')),
  sentiment TEXT CHECK (sentiment IN ('Positive','Negative','Neutral')),
  tags TEXT[] DEFAULT '{}',
  recommended_followup_date DATE,       -- REQ-035
  draft_followup_message TEXT,          -- REQ-035
  open_commitments JSONB DEFAULT '[]',  -- REQ-035
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- TABLE: entities (REQ-018)
-- Unified identity — one row per field per contact
-- ─────────────────────────────────────────
CREATE TABLE entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  field_type TEXT NOT NULL CHECK (field_type IN ('email','phone','social_handle','org_affiliation','location')),
  value TEXT NOT NULL,
  confidence NUMERIC(3,2) CHECK (confidence BETWEEN 0.00 AND 1.00),
  source TEXT NOT NULL,                 -- 'hunter.io' | 'numverify' | 'clearbit' | 'user'
  fetched_at TIMESTAMPTZ NOT NULL,
  override_by TEXT,                     -- 'user' when user overrides (REQ-029)
  override_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- TABLE: relationships (REQ-019)
-- Typed graph edge between two contacts
-- ─────────────────────────────────────────
CREATE TABLE relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id_a UUID REFERENCES contacts(id) ON DELETE CASCADE,
  entity_id_b UUID REFERENCES contacts(id) ON DELETE CASCADE,
  relationship_type TEXT CHECK (relationship_type IN ('colleague','client','referral','family','other')),
  weight NUMERIC(5,2) DEFAULT 0,        -- Derived from interaction frequency
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entity_id_a, entity_id_b, relationship_type)
);

-- ─────────────────────────────────────────
-- TABLE: touchpoints (REQ-021)
-- Cross-channel interaction normalization
-- ─────────────────────────────────────────
CREATE TABLE touchpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  channel TEXT CHECK (channel IN ('call','email','calendar_event','social_dm','social_signal')),
  reference_id UUID,                    -- References call_records.id or external source ID
  summary TEXT,
  sentiment TEXT CHECK (sentiment IN ('Positive','Negative','Neutral')),
  occurred_at TIMESTAMPTZ NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- TABLE: enrichment_jobs (REQ-023, REQ-028)
-- ─────────────────────────────────────────
CREATE TABLE enrichment_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  stage INTEGER CHECK (stage BETWEEN 1 AND 6),
  status TEXT CHECK (status IN ('PENDING','IN_PROGRESS','COMPLETE','FAILED','DEAD_LETTER')),
  attempts INTEGER DEFAULT 0,
  result_json JSONB,
  source_name TEXT,
  confidence TEXT CHECK (confidence IN ('HIGH','MEDIUM','LOW')),
  fetched_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- TABLE: user_encryption_keys (REQ-039, REQ-040)
-- Per-user key metadata — actual key material stored in KMS/Vault
-- ─────────────────────────────────────────
CREATE TABLE user_encryption_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  key_reference TEXT NOT NULL,          -- Reference to key in KMS; never the raw key
  algorithm TEXT DEFAULT 'AES-256-GCM',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rotated_at TIMESTAMPTZ
);

-- ─────────────────────────────────────────
-- TABLE: social_signals (REQ-032, REQ-033)
-- ─────────────────────────────────────────
CREATE TABLE social_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  platform TEXT CHECK (platform IN ('twitter','linkedin','instagram')),
  signal_type TEXT CHECK (signal_type IN ('role_change','product_launch','life_event','thought_leadership','other')),
  content TEXT,
  source_url TEXT,
  gemini_reply_suggestion TEXT,         -- REQ-034
  occurred_at TIMESTAMPTZ NOT NULL,
  classified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- INDEXES for performance
-- ─────────────────────────────────────────
CREATE INDEX idx_call_records_contact_id ON call_records(contact_id);
CREATE INDEX idx_call_records_timestamp ON call_records(timestamp DESC);
CREATE INDEX idx_entities_contact_id ON entities(contact_id);
CREATE INDEX idx_touchpoints_contact_id ON touchpoints(contact_id);
CREATE INDEX idx_touchpoints_occurred_at ON touchpoints(occurred_at DESC);
CREATE INDEX idx_enrichment_jobs_contact_id ON enrichment_jobs(contact_id);
CREATE INDEX idx_enrichment_jobs_status ON enrichment_jobs(status);
CREATE INDEX idx_social_signals_contact_id ON social_signals(contact_id);
CREATE INDEX idx_relationships_entity_a ON relationships(entity_id_a);
CREATE INDEX idx_relationships_entity_b ON relationships(entity_id_b);
