# Horizon PRM — Complete Database Schema Reference

> Generated: 2026-05-31
> Source: Supabase migrations (001–004) + schema.sql artifacts

---

## Overview

The Horizon PRM database runs on **Supabase (PostgreSQL)** with 4 applied migrations. It uses:
- **pgcrypto** — `gen_random_uuid()` UUID generation
- **pgvector** — 768-dimensional vector embeddings (HNSW index, cosine distance)

**17 tables total.** Core entities are `contacts` and `organizations`, with related tables for calls, tasks, projects, enrichment, social signals, and supporting infrastructure.

---

## Migrations Applied

| File | Contents |
|------|----------|
| `001_actions_and_entities.sql` | Core tables: call_logs, tasks, projects, entities, vectors, attachments |
| `002_call_recordings.sql` | Richer call_recordings table with parsing metadata |
| `003_portal_sync_log.sql` | Portal sync tracking table |
| `004_fix_call_recordings_rls.sql` | Row-level security policies |

---

## Tables

---

### `contacts`
Core entity representing a person or relationship.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NOT NULL | gen_random_uuid() | PRIMARY KEY |
| name | TEXT | NOT NULL | — | Contact's full name |
| phone | TEXT | NULL | — | Phone number |
| email | TEXT | NULL | — | Email address |
| organization_id | UUID | NULL | — | FK → organizations(id) ON DELETE SET NULL |
| notes | TEXT | NULL | — | Free-form notes |
| tags | TEXT[] | NOT NULL | '{}' | Array of tag strings |
| health_score | NUMERIC(5,2) | NOT NULL | 0 | Relationship health 0–100; CHECK (0–100) |
| last_contact_at | TIMESTAMPTZ | NULL | — | Timestamp of last interaction |
| created_at | TIMESTAMPTZ | NOT NULL | NOW() | Record creation time |
| updated_at | TIMESTAMPTZ | NOT NULL | NOW() | Record last update time |

**Indexes:** `idx_contacts_phone` ON contacts(phone)

---

### `organizations`
Company/organization data for contact enrichment (REQ-020).

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NOT NULL | gen_random_uuid() | PRIMARY KEY |
| name | TEXT | NOT NULL | — | Organization name |
| industry | TEXT | NULL | — | Industry classification |
| headcount_range | TEXT | NULL | — | e.g. "50-100" |
| funding_stage | TEXT | NULL | — | e.g. "Series A" |
| website | TEXT | NULL | — | Company website URL |
| enrichment_record_id | UUID | NULL | — | Reference to enrichment service record |
| created_at | TIMESTAMPTZ | NOT NULL | NOW() | Record creation time |
| updated_at | TIMESTAMPTZ | NOT NULL | NOW() | Record last update time |

---

### `call_logs`
Normalized call log with deduplication support.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NOT NULL | gen_random_uuid() | PRIMARY KEY |
| contact_id | UUID | NULL | — | FK → contacts(id) ON DELETE SET NULL |
| phone_number | TEXT | NOT NULL | — | Phone number from call |
| timestamp | TIMESTAMPTZ | NOT NULL | NOW() | When the call occurred |
| duration | INTEGER | NULL | — | Call duration in seconds |
| direction | TEXT | NULL | — | CHECK: 'inbound', 'outbound', 'unknown' |
| source | TEXT | NOT NULL | 'acr' | CHECK: 'acr', 'manual', 'import' |
| raw_data | JSONB | NULL | — | Unstructured call metadata |
| created_at | TIMESTAMPTZ | NOT NULL | NOW() | Record creation time |

**Constraints:** UNIQUE (phone_number, timestamp) — deduplication guard

**Indexes:**
- `idx_call_logs_contact` ON call_logs(contact_id)
- `idx_call_logs_phone` ON call_logs(phone_number)
- `idx_call_logs_timestamp` ON call_logs(timestamp DESC)

---

### `call_records`
Encrypted transcript storage with sentiment & action items. **Legacy** — superseded by `call_recordings`.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NOT NULL | gen_random_uuid() | PRIMARY KEY |
| contact_id | UUID | NULL | — | FK → contacts(id) ON DELETE SET NULL |
| contact_name | TEXT | NULL | — | Name cached from contact |
| phone_number | TEXT | NULL | — | Phone number |
| duration | INTEGER | NULL | — | Call duration in seconds |
| transcript_encrypted | BYTEA | NULL | — | AES-256-GCM ciphertext (REQ-039) |
| transcript_iv | TEXT | NULL | — | Initialization vector for decryption |
| executive_brief | JSONB | NULL | — | AI-generated structured brief |
| status | TEXT | NULL | — | CHECK: 'QUEUED', 'COMPLETED', 'SKIPPED_SHORT', 'ERROR' |
| sentiment | TEXT | NULL | — | CHECK: 'Positive', 'Negative', 'Neutral' |
| tags | TEXT[] | NOT NULL | '{}' | Auto-generated tags |
| recommended_followup_date | DATE | NULL | — | Suggested follow-up date (REQ-035) |
| draft_followup_message | TEXT | NULL | — | AI-generated draft message (REQ-035) |
| open_commitments | JSONB | NOT NULL | '[]' | Tracked commitments (REQ-035) |
| timestamp | TIMESTAMPTZ | NOT NULL | NOW() | When call occurred |
| created_at | TIMESTAMPTZ | NOT NULL | NOW() | Record creation time |

**RLS Policies:** Allow INSERT + SELECT to anon, authenticated roles.

**Indexes:**
- `idx_call_records_contact_id` ON call_records(contact_id)
- `idx_call_records_timestamp` ON call_records(timestamp DESC)

---

### `call_recordings`
Batch-ingested ACR archive records with rich metadata & transcription fields. **Primary call table.**

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NOT NULL | gen_random_uuid() | PRIMARY KEY |
| canonical_name | TEXT | NOT NULL | — | UNIQUE — normalized filename |
| original_name | TEXT | NULL | — | Original filename |
| original_path | TEXT | NULL | — | Original file path |
| pattern | TEXT | NULL | — | Filename pattern: A/B/C/D/E/F/G/H/I/J/K/X |
| contact_name | TEXT | NULL | — | Parsed contact name |
| phone_e164 | TEXT | NULL | — | E.164 formatted phone |
| direction | TEXT | NULL | — | CHECK: 'OUT', 'IN', 'FB', 'ZOOM', 'MIC', 'UNK', '' |
| channel | TEXT | NULL | — | CHECK: 'phone', 'facebook', 'zoom', 'mic' |
| datetime_str | TEXT | NULL | — | YYYYMMDD_HHMMSS format |
| call_timestamp | TIMESTAMPTZ | NULL | — | Parsed call timestamp |
| ch_idx | TEXT | NOT NULL | '' | Channel index: '' / '0' / '1' |
| confidence | TEXT | NULL | — | CHECK: 'high', 'medium', 'low' |
| parse_notes | TEXT | NULL | — | Parsing notes |
| sidecar_path | TEXT | NULL | — | Path to .properties/.json sidecar |
| duration_ms | INTEGER | NULL | — | Duration in milliseconds |
| duration_sec | NUMERIC(10,1) | NULL | — | Duration in seconds |
| lat | NUMERIC(11,8) | NULL | — | GPS latitude |
| lon | NUMERIC(11,8) | NULL | — | GPS longitude |
| address | TEXT | NULL | — | GPS-derived address |
| size_bytes | BIGINT | NULL | — | File size in bytes |
| mtime | TIMESTAMPTZ | NULL | — | File modification time |
| md5_hash | TEXT | NULL | — | UNIQUE — MD5 deduplication hash |
| transcript_txt | TEXT | NULL | — | Plain text transcript |
| transcript_srt | TEXT | NULL | — | SRT subtitle format |
| whisper_model | TEXT | NULL | — | Whisper model: tiny/base/small/medium/large |
| transcribed_at | TIMESTAMPTZ | NULL | — | Transcription completion time |
| contact_id | UUID | NULL | — | FK → contacts(id) ON DELETE SET NULL |
| executive_brief | JSONB | NULL | — | Gemini-generated brief |
| sentiment | TEXT | NULL | — | Sentiment classification |
| tags | TEXT[] | NULL | — | Auto-generated tags |
| summary | TEXT | NULL | — | Call summary |
| recommended_followup_date | DATE | NULL | — | Suggested follow-up date |
| open_commitments | JSONB | NULL | — | Tracked commitments |
| status | TEXT | NOT NULL | 'QUEUED' | CHECK: 'QUEUED', 'TRANSCRIBING', 'COMPLETED', 'SKIPPED_SHORT', 'DUPLICATE', 'ERROR' |
| error_detail | TEXT | NULL | — | Error message if status='ERROR' |
| created_at | TIMESTAMPTZ | NOT NULL | NOW() | Record creation time |

**RLS Policies:** Allow INSERT + SELECT to anon, authenticated roles.

**Indexes:**
- `idx_call_recordings_phone` ON call_recordings(phone_e164)
- `idx_call_recordings_timestamp` ON call_recordings(call_timestamp DESC)
- `idx_call_recordings_contact_name` ON call_recordings(contact_name)
- `idx_call_recordings_md5` ON call_recordings(md5_hash)
- `idx_call_recordings_contact_id` ON call_recordings(contact_id)
- `idx_call_recordings_status` ON call_recordings(status)

---

### `tasks`
Action items extracted from call briefs or created manually.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NOT NULL | gen_random_uuid() | PRIMARY KEY |
| title | TEXT | NOT NULL | — | Task title |
| description | TEXT | NULL | — | Detailed description |
| status | TEXT | NOT NULL | 'pending' | CHECK: 'pending', 'in_progress', 'completed', 'cancelled' |
| source | TEXT | NOT NULL | 'user' | CHECK: 'user', 'ai_generated', 'ai_approved' |
| priority | TEXT | NOT NULL | 'medium' | CHECK: 'low', 'medium', 'high', 'urgent' |
| due_date | DATE | NULL | — | Due date |
| project_id | UUID | NULL | — | FK → projects(id) ON DELETE SET NULL |
| contact_id | UUID | NULL | — | FK → contacts(id) ON DELETE SET NULL |
| contact_name | TEXT | NULL | — | Cached contact name |
| tags | TEXT[] | NOT NULL | '{}' | Task tags |
| ai_confidence | FLOAT | NULL | — | AI confidence score (0–1) |
| created_at | TIMESTAMPTZ | NOT NULL | NOW() | Record creation time |
| updated_at | TIMESTAMPTZ | NOT NULL | NOW() | Auto-updated via trigger |

**Triggers:** `trg_tasks_updated` BEFORE UPDATE → `set_updated_at()`

**Indexes:** idx_tasks_status, idx_tasks_project, idx_tasks_contact, idx_tasks_due

---

### `projects`
Project groupings for tasks.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NOT NULL | gen_random_uuid() | PRIMARY KEY |
| title | TEXT | NOT NULL | — | Project name |
| description | TEXT | NULL | — | Project description |
| status | TEXT | NOT NULL | 'active' | CHECK: 'active', 'on_hold', 'completed', 'archived' |
| notes | TEXT | NULL | — | Additional notes |
| tags | TEXT[] | NOT NULL | '{}' | Project tags |
| start_date | DATE | NULL | — | Project start date |
| end_date | DATE | NULL | — | Project end date |
| created_at | TIMESTAMPTZ | NOT NULL | NOW() | Record creation time |
| updated_at | TIMESTAMPTZ | NOT NULL | NOW() | Auto-updated via trigger |

**Triggers:** `trg_projects_updated` BEFORE UPDATE → `set_updated_at()`

**Indexes:** `idx_projects_status` ON projects(status)
