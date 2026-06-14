# Horizon PRM — Database Schema Map & Supabase Integration Guide

This document provides a complete, authoritative mapping of the Horizon PRM database schema as deployed in Supabase. It includes table structures, constraints, indexes, triggers, custom views, and Row Level Security (RLS) configurations, highlighting crucial differences between migration files, design documents (`schema.sql`), and the live active columns.

---

## 1. Supabase-Specific Integration Patterns

### Authentication & User Scoping
* **`auth.users` Integration**: Core tables (`contacts`, `call_records`, `profiles`, `user_encryption_keys`) reference `auth.users(id)` to scope records to individual users.
* **`profiles` Table**: A lookup table keyed on `id = auth.users.id` that stores Google OAuth credentials (specifically `google_refresh_token`) to authorize contacts synchronization via the Google People API.
* **Service Role Bypassing**: The FastAPI backend performs operations using the `SUPABASE_SERVICE_ROLE_KEY`, which bypasses RLS policies entirely. This enables seamless single-tenant execution while leaving user-scoping RLS rules ready for multi-tenant extensions.

### pgvector Vector Database Integration
* **`vector` Extension**: Enabled in the database to support semantic search.
* **Google embeddings model**: `text-embedding-004` (producing 768-dimensional vectors) is standard.
* **Embeddings Storage**:
  - **Inline Embeddings**: Both `contacts.embedding` and `call_records.embedding` store embeddings directly on rows for simple, scoped similarity searches.
  - **Centralized Vector Table**: The `vectors` table is a general-purpose store that centralizes content and embeddings for any entity type (`entity_id`, `entity_type`).
* **HNSW Index**: The `vectors` table features a high-performance **Hierarchical Navigable Small World (HNSW)** index (`idx_vectors_hnsw`) configured for cosine similarity:
  ```sql
  CREATE INDEX idx_vectors_hnsw ON vectors USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
  ```

### PL/pgSQL Triggers & Automation
* **Automatic `updated_at` Updates**: The database registers a function `set_updated_at()` and attaches triggers to `tasks`, `projects`, and `entities` to automatically stamp modification times on updates.
  ```sql
  CREATE OR REPLACE FUNCTION set_updated_at()
  RETURNS TRIGGER LANGUAGE plpgsql AS $$
  BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
  $$;
  ```

### Supabase Realtime
* **`pipeline_events` Realtime Broadcasts**: The `pipeline_events` table is registered under the `supabase_realtime` publication channel. The FastAPI backend broadcasts ingestion errors, transcription completions, and enrichment updates by inserting rows into `pipeline_events`, which the React client receives instantly via SSE subscription.

---

## 2. Row Level Security (RLS) Policy Audit

| Table | Current Access Policy | Roles Affected | Security Assessment / Single-Tenant Impact |
|---|---|---|---|
| `call_records` | "Enable all access for now" | public | ⚠️ Open access — dev mode only. Needs strict scoping to `user_id`. |
| `contacts` | "Enable all for anon" + "read for authenticated" | anon + auth | ⚠️ Write access open to anon role. Used for easy syncing, needs fixing. |
| `profiles` | "Enable all for anon" | anon | ⚠️ Stores sensitive `google_refresh_token` in plaintext. Should scope to user. |
| `enrichment_jobs` | Scoped by contact owner | public | ✅ Securely isolated. |
| `social_signals` | Scoped by contact owner | public | ✅ Securely isolated. |
| `user_encryption_keys`| `user_id = auth.uid()` | public | ✅ Securely isolated. |
| `tasks`, `projects` | Open (`allow_all`) | public | ⚠️ Open access. Fine for single-tenant, requires migration to user scope. |
| `attachments` | Open (`allow_all`) | public | ⚠️ Open access. |
| `touchpoints` | Open (`allow_all`) | public | ⚠️ Open access. |
| `relationships` | Open (`allow_all`) | public | ⚠️ Open access. |
| `entities` | Open (`allow_all`) | public | ⚠️ Open access. |
| `vectors` | Open (`allow_all`) | public | ⚠️ Open access. |
| `pipeline_events` | Open (`allow_all`) | public | ℹ️ Open for system-wide broadcasts. |

---

## 3. Database Schema Map

Below is a complete description of the active tables, views, and columns as probed in the Supabase database.

### 3.1. `contacts` (Master Relationship Entities)
Stores the master contact metadata synced from Google Contacts and enriched via OSINT.

* **Columns**:
  - `id` (UUID, PK): Default `gen_random_uuid()`
  - `user_id` (UUID, FK -> `auth.users`): Scopes contact ownership.
  - `first_name` (TEXT, NOT NULL): First name of the contact.
  - `last_name` (TEXT, Nullable): Last name of the contact.
  - `full_name` (TEXT, Nullable): Derived display name.
  - `phone` (TEXT, Nullable): Raw phone number.
  - `email` (TEXT, Nullable): Email address.
  - `organization` (TEXT, Nullable): Name of the organization (denormalized).
  - `organization_id` (UUID, FK -> `organizations(id)`): Link to structural organization profiles.
  - `photo_url` (TEXT, Nullable): URL to contact picture.
  - `birthdate` (DATE, Nullable): Contact birthdate.
  - `notes` (TEXT, Nullable): Personal notes.
  - `tags` (TEXT[], Default `{}`): User-defined relationship labels.
  - `health_score` (NUMERIC(5,2), Default `0`): Relationship health score (0.00 to 100.00).
  - `is_favorite` (BOOLEAN, Default `false`): Favorite status.
  - `total_calls` (INTEGER, Default `0`): Aggregated call counter.
  - `last_contact_at` / `last_contacted` (TIMESTAMPTZ, Nullable): Date of last phone call or email interaction.
  - `last_synced` (TIMESTAMPTZ, Nullable): Last sync status timestamp with Google People API.
  - `google_resource_name` (TEXT, Unique): UNIQUE key mapping to Google Contacts Resource ID.
  - `raw_data` (JSONB, Nullable): Raw person response payload from Google People API.
  - `embedding` (VECTOR(768), Nullable): 768-dimension semantic representation of contact characteristics.
  - `created_at` (TIMESTAMPTZ, Default `now()`)
  - `updated_at` (TIMESTAMPTZ, Default `now()`)
* **Indexes**: PK, `phone` (`idx_contacts_phone`), `organization_id`, `google_resource_name`, `health_score DESC`, `last_contact_at DESC`.

### 3.2. `call_records` (Enriched Call Transcripts & AI Summaries)
Primary log of call transcription and AI-generated follow-ups.

* **Columns**:
  - `id` (UUID, PK): Default `gen_random_uuid()`
  - `user_id` (UUID, FK -> `auth.users`): Scopes record.
  - `contact_id` (UUID, FK -> `contacts(id)`): References the associated contact.
  - `timestamp` (TIMESTAMPTZ, Default `now()`): Actual call occurrence datetime.
  - `contact_name` (TEXT, Nullable): Denormalized contact name for fast client rendering.
  - `phone_number` (TEXT, Nullable): Normalized E.164 phone number.
  - `duration` (TEXT, Nullable): Call duration string.
  - `raw_transcript` (TEXT, Nullable): Direct plain text Whisper output.
  - `transcript` (TEXT, Nullable): Post-processed, diarized transcript text.
  - `audio_path` (TEXT, Nullable): Local server filesystem path to the audio recording.
  - `executive_brief` (JSONB, Nullable): AI outputs: `{title, summary, action_items, key_points, tags, keywords, sentiment}`.
  - `sentiment` (TEXT, Nullable): CHECK constraint -> `Positive`, `Neutral`, `Negative`.
  - `tags` (TEXT[], Default `{}`): AI or user-added tags (e.g. `['urgent']`).
  - `recommended_followup_date` (DATE, Nullable): Proactive follow-up schedule suggestions.
  - `draft_followup_message` (TEXT, Nullable): AI-generated outreach draft.
  - `open_commitments` (JSONB, Default `[]`): Structured array of commitments extracted -> `[{commitment, deadline, owner}]`.
  - `embedding` (VECTOR(768), Nullable): Call semantic embeddings.
  - `acr_pattern` (TEXT, Default `''`): Filename regex category index (A-X).
  - `acr_channel` (TEXT, Default `''`): Source: `phone`, `facebook`, `zoom`, `mic`.
  - `acr_direction` (TEXT, Default `''`): Direction: `Incoming`, `Outgoing`.
  - `acr_phone_e164` (TEXT, Default `''`): Parsed phone string.
  - `external_id` (TEXT, Unique): Unique index mapping to source ACR phone event ID (prevents duplicates).
  - `status` (TEXT, Default `'pending'`): Lowercase state CHECK constraint -> `'pending'`, `'processing'`, `'completed'`, `'error'`.
  - `created_at` (TIMESTAMPTZ, Default `now()`)
* **Indexes**: PK, `external_id` (Unique), `contact_id`, `user_id`, `timestamp DESC`, `phone_number`, `status`.

> ⚠️ **Design Discrepancy Note**: The design specification in `schema.sql` defined columns `transcript_encrypted` (BYTEA) and `transcript_iv` (TEXT) for AES-256-GCM encryption. The active database instead stores `raw_transcript` and `transcript` as plaintext TEXT columns. Notion sync pipelines should expect plaintext.

### 3.3. `call_recordings` (Audio Archive Catalog)
Batch ingestion audio asset registry, decoupling disk files from PRM models.

* **Columns**:
  - `id` (UUID, PK)
  - `canonical_name` (TEXT, Unique, NOT NULL): Format: `YYYY-MM-DD_HHMMSS_DIR_PHONE_Name.ext`
  - `original_name` (TEXT): Pre-processed source file name.
  - `original_path` (TEXT)
  - `pattern` (TEXT): Regex parsed pattern index.
  - `contact_name` (TEXT)
  - `phone_e164` (TEXT)
  - `direction` (TEXT): CHECK -> `OUT`, `IN`, `FB`, `ZOOM`, `MIC`, `UNK`, `''`.
  - `channel` (TEXT): CHECK -> `phone`, `facebook`, `zoom`, `mic`.
  - `datetime_str` (TEXT)
  - `call_timestamp` (TIMESTAMPTZ)
  - `ch_idx` (TEXT, Default `''`)
  - `confidence` (TEXT): CHECK -> `high`, `medium`, `low`.
  - `parse_notes` (TEXT)
  - `sidecar_path` (TEXT): Path to companion properties file.
  - `duration_ms` (INTEGER)
  - `duration_sec` (NUMERIC(10,1))
  - `lat` / `lon` (NUMERIC(11,8)): GPS coordinates.
  - `address` (TEXT): Reverse-geocoded location descriptor.
  - `size_bytes` (BIGINT)
  - `mtime` (TIMESTAMPTZ)
  - `md5_hash` (TEXT, Unique): File hash used for deduplication.
  - `transcript_txt` / `transcript_srt` (TEXT)
  - `whisper_model` (TEXT)
  - `transcribed_at` (TIMESTAMPTZ)
  - `contact_id` (UUID, FK -> `contacts(id)`)
  - `executive_brief` (JSONB)
  - `sentiment` (TEXT)
  - `tags` (TEXT[])
  - `summary` (TEXT)
  - `recommended_followup_date` (DATE)
  - `open_commitments` (JSONB)
  - `status` (TEXT, Default `'QUEUED'`): UPPERCASE CHECK constraint -> `'QUEUED'`, `'TRANSCRIBING'`, `'COMPLETED'`, `'SKIPPED_SHORT'`, `'DUPLICATE'`, `'ERROR'`.
  - `error_detail` (TEXT)
  - `created_at` (TIMESTAMPTZ, Default `now()`)
* **Indexes**: PK, `canonical_name` (Unique), `md5_hash` (Unique), `phone_e164`, `call_timestamp DESC`, `contact_id`.

### 3.4. `call_logs` (ACR Ingestion Events)
Lightweight logging table for instant Webhook acknowledgements.

* **Columns**:
  - `id` (UUID, PK)
  - `contact_id` (UUID, FK -> `contacts(id)`)
  - `phone_number` (TEXT, NOT NULL)
  - `timestamp` (TIMESTAMPTZ, Default `now()`)
  - `duration` (INTEGER): Duration in seconds.
  - `direction` (TEXT): CHECK -> `'inbound'`, `'outbound'`, `'unknown'`.
  - `source` (TEXT, Default `'acr'`)
  - `raw_data` (JSONB): Raw webhook payload.
  - `created_at` (TIMESTAMPTZ, Default `now()`)
* **Constraints**: `uq_call_log` UNIQUE on `(phone_number, timestamp)`.

### 3.5. `tasks` (Action Items)
Tasks extracted from call briefs or created by the user.

* **Columns**:
  - `id` (UUID, PK)
  - `title` (TEXT, NOT NULL)
  - `description` (TEXT, Nullable)
  - `status` (TEXT, Default `'pending'`): CHECK -> `'pending'`, `'in_progress'`, `'completed'`, `'cancelled'`.
  - `source` (TEXT, Default `'user'`): CHECK -> `'user'`, `'ai_generated'`, `'ai_approved'`.
  - `priority` (TEXT, Default `'medium'`): CHECK -> `'low'`, `'medium'`, `'high'`, `'urgent'`.
  - `due_date` (DATE, Nullable)
  - `project_id` (UUID, FK -> `projects(id)`): Association container.
  - `contact_id` (UUID, FK -> `contacts(id)`): Related context profile.
  - `contact_name` (TEXT, Nullable)
  - `tags` (TEXT[], Default `{}`)
  - `ai_confidence` (DOUBLE PRECISION, Nullable)
  - `created_at` (TIMESTAMPTZ, Default `now()`)
  - `updated_at` (TIMESTAMPTZ, Default `now()`)
* **Trigger**: `trg_tasks_updated` -> BEFORE UPDATE executes `set_updated_at()`.

### 3.6. `projects` (Groupings of Tasks)
* **Columns**:
  - `id` (UUID, PK)
  - `title` (TEXT, NOT NULL)
  - `description` (TEXT, Nullable)
  - `status` (TEXT, Default `'active'`): CHECK -> `'active'`, `'on_hold'`, `'completed'`, `'archived'`.
  - `notes` (TEXT, Nullable)
  - `tags` (TEXT[], Default `{}`)
  - `start_date` / `end_date` (DATE, Nullable)
  - `created_at` / `updated_at` (TIMESTAMPTZ, Default `now()`)
* **Trigger**: `trg_projects_updated` -> BEFORE UPDATE executes `set_updated_at()`.

### 3.7. `entities` (OSINT Metadata Facts)
Normalised field-level facts on contacts.

* **Columns**:
  - `id` (UUID, PK)
  - `contact_id` (UUID, FK -> `contacts(id)` ON DELETE CASCADE)
  - `field_type` (TEXT, NOT NULL): CHECK -> `'email'`, `'phone'`, `'social_handle'`, `'org_affiliation'`, `'location'`.
  - `value` (TEXT, NOT NULL)
  - `confidence` (NUMERIC(3,2)): Value range 0.00 to 1.00.
  - `source` (TEXT, NOT NULL): Source origin (e.g. `numverify`, `clearbit`, `user`).
  - `fetched_at` (TIMESTAMPTZ, NOT NULL)
  - `override_by` (TEXT, Nullable)
  - `override_at` (TIMESTAMPTZ, Nullable)
  - `created_at` (TIMESTAMPTZ, Default `now()`)

### 3.8. `relationships` (Contact Network Graph)
Tracks edges between contacts.

* **Columns**:
  - `id` (UUID, PK)
  - `entity_id_a` (UUID, FK -> `contacts(id)` ON DELETE CASCADE)
  - `entity_id_b` (UUID, FK -> `contacts(id)` ON DELETE CASCADE)
  - `relationship_type` (TEXT): CHECK -> `'colleague'`, `'client'`, `'referral'`, `'family'`, `'other'`.
  - `weight` (NUMERIC(5,2), Default `0`): Metric score representing interaction frequency/strength.
  - `created_at` / `updated_at` (TIMESTAMPTZ, Default `now()`)
* **Constraints**: UNIQUE `(entity_id_a, entity_id_b, relationship_type)`.

### 3.9. `entity_relationships` (OSINT Entity Network Graph)
Tracks edges between entity records.

* **Columns**:
  - `id` (UUID, PK)
  - `from_entity_id` (UUID, FK -> `entities(id)` ON DELETE CASCADE)
  - `to_entity_id` (UUID, FK -> `entities(id)` ON DELETE CASCADE)
  - `type` (TEXT, NOT NULL): CHECK -> `'assigned_to'`, `'related_to'`, `'located_at'`, `'belongs_to'`, `'references'`.
  - `weight` (DOUBLE PRECISION, Default `1.0`)
  - `metadata` (JSONB, Default `{}`)
  - `created_at` (TIMESTAMPTZ, Default `now()`)
* **Constraints**: UNIQUE `(from_entity_id, to_entity_id, type)`.

### 3.10. `touchpoints` (Cross-channel Logs)
Consolidated interaction timelines.

* **Columns**:
  - `id` (UUID, PK)
  - `contact_id` (UUID, FK -> `contacts(id)` ON DELETE CASCADE)
  - `channel` (TEXT): CHECK -> `'call'`, `'email'`, `'calendar_event'`, `'social_dm'`, `'social_signal'`.
  - `reference_id` (UUID, Nullable): Optional pointer referencing `call_records.id` or external source ID.
  - `summary` (TEXT, Nullable): AI summary of interaction.
  - `sentiment` (TEXT, Nullable): CHECK -> `'Positive'`, `'Negative'`, `'Neutral'`.
  - `occurred_at` (TIMESTAMPTZ, NOT NULL)
  - `metadata` (JSONB, Default `{}`)

### 3.11. `enrichment_jobs` (OSINT Queue Manager)
Tracks multi-stage contact profile enrichment.

* **Columns**:
  - `id` (UUID, PK)
  - `contact_id` (UUID, FK -> `contacts(id)` ON DELETE CASCADE)
  - `stage` (INTEGER): Stage count 1 to 6 CHECK.
  - `status` (TEXT): CHECK -> `'PENDING'`, `'IN_PROGRESS'`, `'COMPLETE'`, `'FAILED'`, `'DEAD_LETTER'`.
  - `attempts` (INTEGER, Default `0`)
  - `result_json` (JSONB, Nullable)
  - `source_name` (TEXT, Nullable)
  - `confidence` (TEXT, Nullable): CHECK -> `'HIGH'`, `'MEDIUM'`, `'LOW'`.
  - `fetched_at` (TIMESTAMPTZ, Nullable)
  - `error_message` (TEXT, Nullable)
  - `created_at` / `updated_at` (TIMESTAMPTZ, Default `now()`)

### 3.12. `social_signals` (Social Media Event Log)
* **Columns**:
  - `id` (UUID, PK)
  - `contact_id` (UUID, FK -> `contacts(id)` ON DELETE CASCADE)
  - `platform` (TEXT): CHECK -> `'twitter'`, `'linkedin'`, `'instagram'`.
  - `signal_type` (TEXT): CHECK -> `'role_change'`, `'product_launch'`, `'life_event'`, `'thought_leadership'`, `'other'`.
  - `content` (TEXT, Nullable)
  - `source_url` (TEXT, Nullable)
  - `gemini_reply_suggestion` (TEXT, Nullable): Draft replies.
  - `occurred_at` (TIMESTAMPTZ, NOT NULL)
  - `classified_at` (TIMESTAMPTZ, Nullable)
  - `created_at` (TIMESTAMPTZ, Default `now()`)

### 3.13. `vectors` (Centralized Semantic Vector Store)
* **Columns**:
  - `id` (UUID, PK)
  - `entity_id` (UUID, NOT NULL)
  - `entity_type` (TEXT, NOT NULL): Context description (`call_record`, `contact`, etc.)
  - `content` (TEXT, NOT NULL): Raw text input used to generate vectors.
  - `embedding` (VECTOR(768)): Google model embeddings.
  - `model` (TEXT, Default `'text-embedding-004'`)
  - `created_at` (TIMESTAMPTZ, Default `now()`)

### 3.14. `attachments` (File Assets)
* **Columns**:
  - `id` (UUID, PK)
  - `entity_id` (UUID, NOT NULL)
  - `entity_type` (TEXT, NOT NULL): CHECK -> `'task'`, `'project'`, `'contact'`, `'call'`.
  - `file_name` (TEXT, NOT NULL)
  - `file_path` (TEXT, NOT NULL)
  - `file_type` (TEXT, Nullable)
  - `file_size` (BIGINT, Nullable)
  - `url` (TEXT, Nullable)
  - `uploaded_at` (TIMESTAMPTZ, Default `now()`)

### 3.15. `user_encryption_keys` (Decoupled Key Management Registry)
* **Columns**:
  - `id` (UUID, PK)
  - `user_id` (UUID, Unique, NOT NULL)
  - `key_reference` (TEXT, NOT NULL)
  - `algorithm` (TEXT, Default `'AES-256-GCM'`)
  - `created_at` (TIMESTAMPTZ, Default `now()`)
  - `rotated_at` (TIMESTAMPTZ, Nullable)

### 3.16. `profiles` (User Meta Store)
* **Columns**:
  - `id` (UUID, PK): Matches `auth.users.id`.
  - `subscription_status` (TEXT, Default `'Free'`)
  - `calls_analyzed_this_month` (INTEGER, Default `0`)
  - `google_refresh_token` (TEXT, Nullable): OAuth token for Google integration.
  - `created_at` (TIMESTAMPTZ, Default `now()`)

### 3.17. `pipeline_events` (Broadcast Event Feed)
* **Columns**:
  - `id` (UUID, PK)
  - `event_type` (TEXT, NOT NULL)
  - `severity` (TEXT, NOT NULL)
  - `source` (TEXT, NOT NULL)
  - `reference_id` (UUID, Nullable)
  - `reference_type` (TEXT, Nullable)
  - `message` (TEXT, NOT NULL)
  - `detail` (JSONB, Default `'{}'`)
  - `created_at` (TIMESTAMPTZ, Default `now()`)

---

## 4. Custom Views

### 4.1. `project_task_stats`
Used to compute the progress statistics of tasks mapped to projects.
* **SQL Query Definition**:
  ```sql
  CREATE OR REPLACE VIEW project_task_stats AS
  SELECT
      p.id                                            AS project_id,
      p.title                                         AS project_title,
      COUNT(t.id)                                     AS total_tasks,
      COUNT(t.id) FILTER (WHERE t.status = 'completed') AS completed_tasks,
      ROUND(
          COUNT(t.id) FILTER (WHERE t.status = 'completed')::numeric /
          NULLIF(COUNT(t.id), 0) * 100,
      1)                                              AS completion_pct
  FROM projects p
  LEFT JOIN tasks t ON t.project_id = p.id
  GROUP BY p.id, p.title;
  ```

### 4.2. `v_system_health`
Active dashboard view monitoring background pipeline statistics.
* **Columns returned**:
  - `calls_pending` (INTEGER): Records awaiting transcription.
  - `calls_processing` (INTEGER): Records currently running transcription.
  - `calls_completed` (INTEGER): Successfully processed recordings.
  - `calls_error` (INTEGER): Failures in transcription/analysis.
  - `calls_stuck` (INTEGER): Records in `processing` status for over 30 minutes.
  - `calls_completed_no_transcript` (INTEGER): Call records complete but missing text.
  - `calls_no_embedding` (INTEGER): Records missing semantic embeddings.
  - `errors_last_24h` (INTEGER): Aggregated error logs count.
  - `total_call_records` (INTEGER): Raw count of all records.
  - `snapshot_at` (TIMESTAMPTZ)

---

## 5. Database Entity Relationship Diagram (ERD)

The diagram below maps all key relationships between Horizon PRM tables. All lines indicate standard Foreign Key references (`FK -> PK`).

```
                              +--------------------+
                              |     auth.users     |
                              +---------+----------+
                                        |
                 +----------------------+----------------------+
                 | (1:1)                | (1:N)                | (1:N)
                 v                      v                      v
        +--------+-------+     +--------+-------+     +--------+-------+
        |    profiles    |     |    contacts    |     |  call_records  |
        +----------------+     +----+---+----+--+     +--------+-------+
                                    |   |    |                 |
     +------------------------------+   |    +------------+    |
     | (1:N)                            | (1:N)           |    |
     v                                  v                 |    | (1:N)
+----+-------+                     +----+-------+         |    v
|  entities  +<--+ (1:N)           | touchpoints|         |  +---------+
+----+-------+   |                 +----+-------+         |  | vectors |
     |           |                      ^                 |  +---------+
     | (1:N)     | (1:N)                | (1:N)           |
     v           |                      |                 |
+----+-------+   |                      | (reference_id)  |
|entity_     |   |                      |                 |
|relationship|   |                      |                 |
+------------+   |                      |                 |
                 +----------+           |                 |
                            |           |                 |
                            |           |                 | (1:N)
                      +-----+-----+     |                 v
                      |relationships    |            +----+----+
                      +-----------+     |            |  tasks  |
                                        |            +----+----+
                                        |                 |
                                        |                 | (N:1)
                                        |                 v
                                        |            +----+----+
                                        |            |projects |
                                        |            +----+----+
                                        |                 | (1:N)
                                        |                 |
                                        +-----------------+
```

### Table Relationships Glossary
1. **`contacts.user_id`** references **`auth.users.id`** (Scopes contact metadata).
2. **`contacts.organization_id`** references **`organizations.id`** (Structural employer tags).
3. **`call_records.contact_id`** references **`contacts.id`** (Logs call under contact profile).
4. **`call_records.user_id`** references **`auth.users.id`** (Scopes call records).
5. **`call_recordings.contact_id`** references **`contacts.id`** (Links raw drive backup record to contact).
6. **`call_logs.contact_id`** references **`contacts.id`** (Links instant webhook payloads).
7. **`entities.contact_id`** references **`contacts.id`** (Details factual attributes).
8. **`relationships.entity_id_a`** & **`entity_id_b`** reference **`contacts.id`** (Edge maps interaction network).
9. **`touchpoints.contact_id`** references **`contacts.id`** (Adds to activity timeline).
10. **`touchpoints.reference_id`** references **`call_records.id`** (Links timeline events to source transcripts).
11. **`enrichment_jobs.contact_id`** references **`contacts.id`** (Triggers pipeline against contact).
12. **`social_signals.contact_id`** references **`contacts.id`** (Feeds social changes into contact context).
13. **`tasks.contact_id`** references **`contacts.id`** (Attaches action items to contacts).
14. **`tasks.project_id`** references **`projects.id`** (Organizes tasks within projects).
15. **`entity_relationships.from_entity_id`** & **`to_entity_id`** reference **`entities.id`** (Edge maps OSINT information network).
16. **`user_encryption_keys.user_id`** references **`auth.users.id`** (User KMS mappings).
17. **`profiles.id`** references **`auth.users.id`** (1-to-1 extension of user credentials).
