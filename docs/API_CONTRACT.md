# Horizon PRM — API Contract & System Map
> **Version:** 2.0 | **Updated:** 2026-05-13 | **Supabase project:** `jykucnzotuqingrhufdx`
>
> This is the authoritative map of every API endpoint, database table, type definition, and data flow in Horizon PRM. Update it before or alongside every new feature. Drift between this document and the code is a bug.

---

## Table of Contents

1. [Architecture & Zone Model](#1-architecture--zone-model)
2. [Base URLs & Authentication Matrix](#2-base-urls--authentication-matrix)
3. [Router Registry](#3-router-registry)
4. [Endpoint Contracts](#4-endpoint-contracts)
5. [Database — Complete Schema](#5-database--complete-schema)
6. [Type Definitions](#6-type-definitions)
7. [State Machines](#7-state-machines)
8. [Real-time & SSE Events](#8-real-time--sse-events)
9. [Naming & Convention Rules](#9-naming--convention-rules)
10. [How to Add a New Feature](#10-how-to-add-a-new-feature)
11. [Known Gaps & Planned Work](#11-known-gaps--planned-work)

---

## 1. Architecture & Zone Model

```
Zone 1 — THE VAULT (Supabase / PostgreSQL @ jykucnzotuqingrhufdx.supabase.co)
    ↕  Supabase SDK / SQL (service role key — bypasses RLS)
Zone 2 — THE ENGINE (Python Backend)
    Port 8000  main.py          — CRUD, AI, sync, nudges, enrichment, digest
    Port 9000  ingestion_server.py — Audio webhook, transcription, Sentinel, SSE inspector
    ↕  HTTP REST / JSON  ←  this document governs this boundary
Zone 3 — THE DASHBOARD (React / Vite @ localhost:3000)
    ↕  Capacitor bridge
Zone 4 — MOBILE DEVICE (Android — com.legitk1ng.horizon)
```

**Non-negotiable rules:**
- Zone 3 **never** calls Gemini, Whisper, Pyannote, or the Google People API.
- Zone 3 **may** read Supabase directly (anon key + RLS).
- Zone 2 **owns** all AI. It writes finalized data to Zone 1; Zone 3 reads it.
- `VITE_GEMINI_API_KEY` is intentionally absent from the frontend env (REQ-027).

---

## 2. Base URLs & Authentication Matrix

### Base URLs

| Environment | URL |
|---|---|
| Local dev — API | `http://localhost:8000` |
| Local dev — Ingestion | `http://localhost:9000` |
| Mobile APK (native) | `https://hp-z2g3-mini-workstation.tailb79f25.ts.net` (ingestion only) |
| Mobile APK (API) | `VITE_BACKEND_URL_MOBILE` env var |
| Supabase | `https://jykucnzotuqingrhufdx.supabase.co` |

### Authentication Matrix

| Endpoint group | Auth mechanism | Header / field |
|---|---|---|
| All `/api/v1/*` endpoints | Internal (no external auth yet) | None required |
| `POST /api/v1/calls` | ACR secret | `X-ACR-Secret: <ACR_WEBHOOK_SECRET>` |
| `POST /v1/audio/transcriptions` | Bearer token OR form secret | `Authorization: Bearer <HORIZON_API_KEY>` **or** `Secret` form field |
| Rate limit | Per-IP, 120 RPM default | Configurable via `RATE_LIMIT_RPM` env |
| Rate limit exemption | SSE stream endpoint | `/api/v1/events/stream` is exempt |

---

## 3. Router Registry

**16 registered routers** as of 2026-05-13. All mounted in `mcp-backend/main.py`.

| # | Prefix | Router file | Tag | Notes |
|---|---|---|---|---|
| 1 | `/api/v1/health` | `routers/health.py` | health | Liveness + model readiness |
| 2 | `/api/v1/auth` | `routers/auth.py` | auth | Google OAuth handshake |
| 3 | `/api/v1/system` | `routers/system.py` | system | Diagnostics, models, tags |
| 4 | `/api/v1/calls` | `routers/calls.py` | ingestion | Call ingest + list |
| 5 | `/api/v1/contacts` | `routers/contacts.py` | contacts | Full contacts CRUD + search |
| 6 | `/api/v1/sync` | `routers/sync.py` | sync | Google Contacts / Calendar sync |
| 7 | `/api/v1/data` | `routers/data.py` | data | Dashboard KPI stats |
| 8 | `/api/v1/nudges` | `routers/nudges.py` | nudges | Relationship nudges |
| 9 | `/api/v1/enrichments` | `routers/enrichments.py` | enrichment | OSINT enrichment jobs |
| 10 | `/api/v1/ai` | `routers/ai.py` | ai | Gemini chat, analysis, embed |
| 11 | `/api/v1/ollama` | `routers/ollama.py` | ollama | Local Ollama model proxy |
| 12 | `/api/v1/actions` | `routers/actions.py` | actions | Tasks + Projects CRUD |
| 13 | `/api/v1/events` | `routers/events.py` | events | SSE real-time event stream |
| 14 | `/api/v1/digest` | `routers/digest.py` | digest | Weekly AI relationship digest (REQ-006) |
| 15 | `/api/v1/batch-ingest` | `routers/batch_ingest.py` | batch-ingest | Drive archive bulk ingestion |
| 16 | `/v1/audio` | `routers/transcriptions.py` | transcription | ACR Phone webhook (OpenAI-compat) |

> **Ingestion server** (`ingestion_server.py`, port 9000) mounts only `/v1/audio` plus inline routes for `/v1/health`, `/v1/sentinel/status`, `/v1/inspector`.

---

## 4. Endpoint Contracts

### Health

#### `GET /api/v1/health`
```json
{ "status": "ok", "version": "2.0.0", "db_connected": true, "whisper_ready": false }
```
Frontend: `status === "ok" | "healthy" | "online"` → `isOnline = true`

---

### Contacts

#### `GET /api/v1/contacts`
**Query params:** `page=0` · `limit=500` · `search=<string>` · `favorites_only=false`
```json
{
  "status": "success",
  "data": [Contact],
  "count": 25,
  "total_count": 2514,
  "page": 0,
  "limit": 500,
  "has_more": true
}
```
Frontend auto-paginates via `getAllContacts()` (500 per page × N pages). `searchPerson(q)` maps to `search=<q>&limit=20`.

#### `GET /api/v1/contacts/:id`
Response: single `Contact` (may include computed `health_score`).

#### `PATCH /api/v1/contacts/:id`
Body: partial `ContactUpdate` (any field optional). Response: updated `Contact`.

#### `PATCH /api/v1/contacts/:id/favorite`
Response: `{ "status": "success", "is_favorite": true }`

#### `POST /api/v1/contacts/:id/photo`
Body: `{ "photo_url": "https://..." }` · Response: `{ "status": "success", "photo_url": "..." }`

#### `GET /api/v1/contacts/:id/refresh-health`
Triggers health score recomputation for one contact.

---

### Calls

#### `GET /api/v1/calls`
```json
{ "status": "success", "data": [CallRecord], "count": 12 }
```

#### `POST /api/v1/calls`
**Auth:** `X-ACR-Secret` header must match `ACR_WEBHOOK_SECRET` env var.
**Body:** `multipart/form-data`

| Field | Type | Notes |
|---|---|---|
| `file` | audio blob | optional — .m4a, .mp3, .wav |
| `contact_name` | string | defaults to "Unknown" |
| `phone_number` | string | normalized to E.164 on ingest |
| `duration` | string | call duration |
| `timestamp` | string | ISO 8601 |
| `note` | string | pre-existing transcript or note |

Response: ingested `CallRecord` with AI brief attached.

#### `PATCH /api/v1/calls/:id`
Body: `{ tags?, sentiment?, contact_id?, transcript? }` · Response: updated `CallRecord`.

---

### Dashboard Stats

#### `GET /api/v1/data`
```json
{
  "status": "success",
  "totalContacts": 2514,
  "callsThisWeek": 4,
  "avgHealth": 72,
  "needsAttention": 11
}
```

---

### Nudges

#### `GET /api/v1/nudges`
Response: `{ "data": [Nudge] }`

#### `POST /api/v1/nudges/refresh-all`
Triggers full nudge regeneration. Response: `{ "status": "ok" }`

---

### Enrichment

#### `GET /api/v1/enrichments/?contact_id=<uuid>`
Response: `{ "data": [EnrichmentJob] }`

#### `POST /api/v1/enrichments/`
Body: `{ "contact_id": "uuid" }` · Response: `{ "status": "queued", "job_id": "uuid" }`

Enrichment job lifecycle: `PENDING → IN_PROGRESS → COMPLETE | FAILED | DEAD_LETTER`  
Stages 1–6 (see `enrichment_jobs` table). `attempts` tracks retries; `DEAD_LETTER` = 3 failures.

#### `GET /api/v1/enrichments/:contact_id/photos`
Response: `{ "photos": ["url1", "url2"] }`

---

### AI / Intelligence

#### `POST /api/v1/ai/chat`
Body: `{ "message": "...", "context_id": "<contact_id|call_id|null>" }`
Response: `{ "message": "...", "context_used": true }`
All Gemini inference happens server-side. No API key in frontend.

#### `POST /api/v1/ai/analyze`
Body: `{ "transcript": "..." }` · Response: `{ "data": ExecutiveBrief }`

#### `POST /api/v1/ai/process-transcript`
Body: `{ "transcript": "...", "contact_name": "..." }` · Response: `{ "data": ExecutiveBrief }`

#### `POST /api/v1/ai/embed`
Body: `{ "text": "..." }`
Response: `{ "embedding": [float, …768], "dims": 768, "model": "text-embedding-004" }`
Uses Google `text-embedding-004`. Does **not** require VRAM.

---

### Weekly Digest

#### `GET /api/v1/digest`
REQ-006. Queries last 7 days of `call_records`, passes all executive brief summaries to Gemini `generate_weekly_digest()`, returns a single AI-authored relationship narrative.
```json
{ "status": "success", "digest": "This week you spoke with...", "calls_analyzed": 12 }
```

---

### Actions (Tasks & Projects)

#### `GET /api/v1/actions/tasks`
Response: `{ "data": [Task] }`

#### `POST /api/v1/actions/tasks`
Body: `TaskCreate` · Response: `{ "data": Task }`

#### `PATCH /api/v1/actions/tasks/:id`
Body: partial `Task` · Response: `{ "data": Task }`

#### `DELETE /api/v1/actions/tasks/:id`
Response: 204 No Content.

#### `GET /api/v1/actions/projects`
Response: `{ "data": [Project] }`

#### `POST /api/v1/actions/projects` / `PATCH /api/v1/actions/projects/:id` / `DELETE /api/v1/actions/projects/:id`
Same pattern as tasks.

---

### System

#### `GET /api/v1/system/models`
Response: `{ "models": [{ "name": "...", "displayName": "..." }] }`

#### `GET /api/v1/system/tags`
Response: `{ "tags": ["string", …] }`

#### `GET /api/v1/system/diagnostics`
Response: `{ "status": "ok", "results": [...] }`

#### `POST /api/v1/system/test-gemini`
Tests Gemini API key and returns model response sample.

#### `POST /api/v1/system/trigger-processing`
Manually triggers the transcription queue.

---

### Auth

#### `POST /api/v1/auth/google/callback`
Body: `{ "code": "...", "user_id": "uuid", "redirect_uri": "..." }`
Response: `GoogleTokenResponse` — stores refresh token to `profiles.google_refresh_token`.

---

### Sync

#### `POST /api/v1/sync/google`
Body: `{ "user_id": "uuid", "access_token": "..." }`
Response: `{ "status": "ok", "count": 1822 }`
Syncs Google Contacts into `contacts` table. Upserts on `google_resource_name`.

---

### Batch Ingest

#### `POST /api/v1/batch-ingest`
Bulk ingestion from the Drive archive pipeline. Processes canonically-named audio files from `Audio_Archive/` into `call_records`. Logs each run to `portal_sync_log`.

---

### ACR Phone Webhook (Ingestion Server — Port 9000)

#### `POST /v1/audio/transcriptions`
OpenAI Whisper v1-compatible endpoint. Only publicly-exposed endpoint (via Tailscale Funnel).

**Auth:** `Authorization: Bearer <HORIZON_API_KEY>` **or** `Secret` form field matching `ACR_WEBHOOK_SECRET`.

**Body:** `multipart/form-data` (fields from ACR Phone NLLAPPS app)

| ACR field | Maps to | Notes |
|---|---|---|
| `Secret` | Auth validation | Must match `ACR_WEBHOOK_SECRET` |
| `Source` | `direction` | Call direction metadata (NOT named `direction` in ACR app) |
| `Number` | `phone_number` | Normalize to E.164 |
| `Date` | `timestamp` | Unix long (seconds) |
| `Duration` | `duration` | Integer seconds |
| `Note` | `note` | Pre-existing note |
| `file` | audio blob | .m4a, .mp3, .wav |

**Accepted `model` values:** `whisper-horizon` · `whisper-1` · `whisper-base` · `whisper-small`

**Response:** OpenAI-compatible + Horizon extensions
```json
{
  "text": "Full transcript text...",
  "contact_name": "Gabby Cajucom",
  "call_id": "uuid",
  "processing_time_ms": 4200
}
```

#### `GET /v1/inspector` (SSE)
Real-time request/response event stream. Ring buffer of last 200 events.
Auth headers are masked as `***`. Skips `/v1/inspector` and `/v1/health` paths.

#### `GET /v1/sentinel/status`
HorizonSentinel daemon health: `{ "running": true, "last_cycle": "...", "corrections_made": 3 }`

#### `GET /v1/health`
Ingestion server liveness: `{ "status": "ok" }`

---

### Real-time Events (API Server — Port 8000)

#### `GET /api/v1/events/stream` (SSE)
Frontend subscribes here for live call/contact updates.
Rate limit exempt. See [Section 8](#8-real-time--sse-events) for event payload schemas.

---

## 5. Database — Complete Schema

**Project:** `jykucnzotuqingrhufdx` · **Region:** us-east-1 · **Postgres:** 17.6
**RLS:** Enabled on all tables. Current policies are mostly PERMISSIVE (single-tenant dev mode).

### Live Row Counts (as of 2026-05-13)

| Table | Rows | Notes |
|---|---|---|
| `contacts` | **2,514** | Primary contact graph |
| `call_records` | **5,873** | All ingested calls + AI briefs |
| `profiles` | 1 | Single-user row |
| `projects` | 1 | Single test project |
| `tasks` | 1 | Single test task |
| All others | 0 | Schema in place, ingestion pending |

---

### `contacts`

| Column | Type | Nullable | Default | Constraint |
|---|---|---|---|---|
| `id` | uuid | NO | gen_random_uuid() | PK |
| `user_id` | uuid | NO | — | FK → auth.users |
| `first_name` | text | NO | — | — |
| `last_name` | text | YES | — | — |
| `full_name` | text | YES | — | — |
| `phone` | text | YES | — | — |
| `email` | text | YES | — | — |
| `organization` | text | YES | — | — |
| `organization_id` | uuid | YES | — | FK → organizations |
| `photo_url` | text | YES | — | — |
| `birthdate` | date | YES | — | — |
| `notes` | text | YES | — | — |
| `tags` | text[] | YES | `'{}'` | — |
| `health_score` | numeric | YES | 0 | CHECK 0–100 |
| `is_favorite` | boolean | YES | false | — |
| `total_calls` | integer | YES | 0 | — |
| `last_contact_at` | timestamptz | YES | — | — |
| `last_contacted` | timestamptz | YES | — | — |
| `last_synced` | timestamptz | YES | — | — |
| `google_resource_name` | text | YES | — | UNIQUE — sync anchor |
| `raw_data` | jsonb | YES | — | Full Google People API payload |
| `embedding` | vector | YES | — | Google text-embedding-004 (768d) |
| `created_at` | timestamptz | YES | now() | — |
| `updated_at` | timestamptz | NO | now() | — |

**Indexes:** PK, phone, health_score DESC, last_contact_at DESC, organization_id, raw_data GIN, google_resource_name UNIQUE, user_id, full-text GIN (first+last+org+phone+email)

---

### `call_records`

Primary table for all ingested phone calls with transcripts and AI briefs. 5,873 live rows.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | uuid | NO | gen_random_uuid() | PK |
| `user_id` | uuid | YES | — | FK → auth.users |
| `contact_id` | uuid | YES | — | FK → contacts |
| `contact_name` | text | YES | — | Denormalized for fast display |
| `phone_number` | text | YES | — | E.164 normalized |
| `duration` | text | YES | — | String — validate format on read |
| `timestamp` | timestamptz | YES | — | Call datetime |
| `status` | text | NO | `'pending'` | See state machine below |
| `raw_transcript` | text | YES | — | Plain-text Whisper output |
| `transcript` | text | YES | — | Processed / cleaned transcript |
| `audio_path` | text | YES | — | Local disk path to audio file |
| `executive_brief` | jsonb | YES | — | `{summary, action_items, sentiment, tags, category}` |
| `sentiment` | text | YES | — | CHECK: Positive, Negative, Neutral |
| `tags` | text[] | YES | `'{}'` | — |
| `recommended_followup_date` | date | YES | — | AI-generated follow-up date |
| `draft_followup_message` | text | YES | — | AI-drafted message |
| `open_commitments` | jsonb | YES | `'[]'` | Array of `{commitment, deadline, owner}` |
| `embedding` | vector | YES | — | Semantic embedding for similarity search |
| `acr_pattern` | text | YES | `''` | Filename pattern matched (A–X) |
| `acr_channel` | text | YES | `''` | phone / facebook / zoom / mic |
| `acr_direction` | text | YES | `''` | Outgoing / Incoming |
| `acr_phone_e164` | text | YES | `''` | E.164 phone from filename |
| `external_id` | text | YES | — | UNIQUE — dedup anchor |
| `created_at` | timestamptz | YES | now() | — |

**Status values (lowercase — enforced by DB CHECK):**
`pending` → `processing` → `completed` · `pending` → `processing` → `error`

> ⚠️ **Critical correction:** CONSTITUTION.md previously documented these as uppercase (`QUEUED`, `PROCESSING`, `COMPLETED`). The live DB CHECK constraint uses lowercase. All backend code and frontend status comparisons must use lowercase.

**Indexes:** PK, external_id UNIQUE, contact_id, user_id, phone_number, acr_phone_e164, status, timestamp DESC, sentiment, audio_path (partial — NOT NULL), pending+audio_path (partial), executive_brief GIN, no-embedding (partial), AI context (covering — includes contact_name, sentiment, executive_brief, tags)

---

### `call_recordings`

Drive pipeline canonical recording catalog. Separate from `call_records` — this is the audio file registry, not the AI-enriched call record.

| Column | Type | Notes |
|---|---|---|
| `canonical_name` | text UNIQUE | `YYYY-MM-DD_HHMMSS_DIR_PHONE_Name.ext` |
| `original_name` | text | Pre-rename filename |
| `pattern` | text | A/B/C/…/X — which parser regex matched |
| `phone_e164` | text | E.164 phone |
| `direction` | text | OUT/IN/FB/ZOOM/MIC/UNK |
| `channel` | text | phone/facebook/zoom/mic |
| `call_timestamp` | timestamptz | Parsed call datetime |
| `confidence` | text | high/medium/low |
| `duration_ms` | integer | Milliseconds |
| `duration_sec` | numeric | Seconds |
| `lat`, `lon` | numeric | GPS from .properties sidecar |
| `address` | text | Reverse-geocoded |
| `md5_hash` | text UNIQUE | Deduplication key |
| `transcript_txt` | text | Whisper output |
| `transcribed_at` | timestamptz | When transcription completed |
| `status` | text | QUEUED/TRANSCRIBING/COMPLETED/SKIPPED_SHORT/DUPLICATE/ERROR |
| `contact_id` | uuid | FK → contacts |

> Note: `call_recordings.status` uses UPPERCASE (consistent with GAS pipeline convention). `call_records.status` uses lowercase. These are different tables with different conventions.

---

### `call_logs`

Lightweight ACR raw event log. Simpler than `call_records` — used for quick ACR webhook acknowledgment before full pipeline processing.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | — |
| `contact_id` | uuid | FK → contacts |
| `phone_number` | text | — |
| `timestamp` | timestamptz | DEFAULT now() |
| `duration` | integer | Seconds |
| `direction` | text | inbound/outbound/unknown |
| `source` | text | DEFAULT 'acr' |
| `raw_data` | jsonb | Full ACR payload |

**Unique constraint:** `(phone_number, timestamp)` — prevents duplicate ACR submissions.

---

### `entities`

OSINT field-level data store. Each row is one data point (email, phone, social handle, org affiliation, location) about a contact, with provenance and confidence tracking.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | — |
| `contact_id` | uuid | FK → contacts |
| `type` | text | person / organization |
| `field_type` | text | email/phone/social_handle/org_affiliation/location |
| `value` | text | The actual data point |
| `confidence` | numeric | 0.00–1.00 |
| `source` | text | Source system (e.g. "google_people", "osint") |
| `fetched_at` | timestamptz | When this data was retrieved |
| `override_by` | text | If manually overridden |
| `override_at` | timestamptz | — |
| `contact_info` | jsonb | Legacy structured contact payload |

---

### `relationships`

Contact relationship graph. Tracks how two contacts relate to each other with a typed edge and health score.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | — |
| `entity_id_a` | uuid | FK → contacts |
| `entity_id_b` | uuid | FK → contacts |
| `entity_id` | uuid | FK → entities (legacy FK — prefer a/b) |
| `relationship_type` | text | e.g. "colleague", "family", "client" |
| `health_score` | integer | 0–100 |
| `weight` | numeric | DEFAULT 0 — edge weight for graph algorithms |
| `notes` | text | — |
| `updated_at` | timestamptz | — |

---

### `touchpoints`

Interaction history log. One row per meaningful interaction (call, message, meeting). Links to both `contacts` and `entities`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | — |
| `contact_id` | uuid | FK → contacts |
| `entity_id` | uuid | FK → entities |
| `channel` | text | phone/email/message/meeting |
| `sentiment` | text | Positive/Negative/Neutral |
| `summary` | text | AI-generated summary |
| `action_items` | jsonb | Array of action items |
| `occurred_at` | timestamptz | When the interaction happened |
| `interaction_date` | timestamptz | DEFAULT now() |
| `reference_id` | uuid | FK to source record (e.g. call_records.id) |
| `metadata` | jsonb | DEFAULT `'{}'` |

**Indexes:** contact_id, entity_id, occurred_at DESC

---

### `organizations`

Organization enrichment records. Linked from `contacts.organization_id`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | — |
| `name` | text | — |
| `industry` | text | — |
| `headcount_range` | text | e.g. "50-200" |
| `funding_stage` | text | — |
| `website` | text | — |
| `enrichment_record_id` | uuid | Link to enrichment source |

---

### `enrichment_jobs`

OSINT pipeline job queue. Stages 1–6 represent pipeline phases (carrier lookup → social → OSINT → photo → org → synthesis).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | — |
| `contact_id` | uuid | FK → contacts |
| `stage` | integer | 1–6 CHECK |
| `status` | text | PENDING/IN_PROGRESS/COMPLETE/FAILED/DEAD_LETTER |
| `attempts` | integer | DEFAULT 0 — DEAD_LETTER at 3 |
| `confidence` | text | HIGH/MEDIUM/LOW |
| `result_json` | jsonb | Stage output |
| `source_name` | text | Data source used |
| `error_message` | text | Last error if FAILED |
| `fetched_at` | timestamptz | When data was retrieved |

**RLS:** SELECT scoped to contacts owned by current user. INSERT open.

---

### `social_signals`

Social media event monitoring. Tracks role changes, product launches, life events from Twitter, LinkedIn, Instagram.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | — |
| `contact_id` | uuid | FK → contacts |
| `platform` | text | twitter/linkedin/instagram |
| `signal_type` | text | role_change/product_launch/life_event/thought_leadership/other |
| `content` | text | Raw post/event content |
| `source_url` | text | Link to original |
| `gemini_reply_suggestion` | text | AI-drafted response suggestion |
| `occurred_at` | timestamptz | When the event happened |
| `classified_at` | timestamptz | When Gemini classified it |

**RLS:** SELECT scoped to contacts owned by current user.

---

### `tasks`

Action items — both user-created and AI-generated (from `executive_brief.action_items`).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | — |
| `title` | text | — |
| `description` | text | — |
| `status` | text | pending/in_progress/completed/cancelled |
| `source` | text | user/ai_generated/ai_approved |
| `priority` | text | low/medium/high/urgent |
| `due_date` | date | — |
| `project_id` | uuid | FK → projects |
| `contact_id` | uuid | FK → contacts |
| `contact_name` | text | Denormalized |
| `tags` | text[] | — |
| `ai_confidence` | float8 | AI certainty score when source = ai_generated |

**Indexes:** status, due_date, project_id, contact_id

---

### `projects`

Project containers for grouping related tasks.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | — |
| `title` | text | — |
| `description` | text | — |
| `status` | text | active/on_hold/completed/archived |
| `notes` | text | — |
| `tags` | text[] | — |
| `start_date` / `end_date` | date | — |

---

### `vectors`

Centralized vector store for semantic search. Stores embeddings for any entity type separately from inline columns.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | — |
| `entity_id` | uuid | ID of the source record |
| `entity_type` | text | 'call_record' / 'contact' / 'touchpoint' / etc. |
| `content` | text | The text that was embedded |
| `embedding` | vector | The embedding |
| `model` | text | DEFAULT 'text-embedding-004' |

**Index:** HNSW cosine similarity (`vector_cosine_ops`, m=16, ef_construction=64) — enables sub-millisecond approximate nearest neighbor search.

> Note: Both `contacts.embedding` and `call_records.embedding` also store inline embeddings. The `vectors` table is the centralized store for multi-entity semantic search.

---

### `attachments`

File attachments linked to any entity type.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | — |
| `entity_id` | uuid | ID of the parent record |
| `entity_type` | text | task/project/contact/call |
| `file_name` | text | — |
| `file_path` | text | Storage path |
| `file_type` | text | MIME type |
| `file_size` | bigint | Bytes |
| `url` | text | Public URL |

**Index:** `(entity_id, entity_type)`

---

### `entity_relationships`

Directed graph edges between `entities` records. Separate from `relationships` (which links `contacts` ↔ `contacts`).

| Column | Type | Notes |
|---|---|---|
| `from_entity_id` | uuid | FK → entities |
| `to_entity_id` | uuid | FK → entities |
| `type` | text | assigned_to/related_to/located_at/belongs_to/references |
| `weight` | float8 | DEFAULT 1.0 |
| `metadata` | jsonb | DEFAULT `'{}'` |

**Unique:** `(from_entity_id, to_entity_id, type)` — prevents duplicate edges.

---

### `user_encryption_keys`

Per-user encryption key registry. Stores a key_reference (not the raw key) for future per-user key management. Currently the actual encryption uses `FIELD_ENCRYPTION_MASTER_KEY` env var globally.

| Column | Type | Notes |
|---|---|---|
| `user_id` | uuid UNIQUE | One row per user |
| `key_reference` | text | External key identifier |
| `algorithm` | text | DEFAULT 'AES-256-GCM' |
| `rotated_at` | timestamptz | Last rotation timestamp |

**RLS:** `user_id = auth.uid()` — user-scoped only.

---

### `profiles`

One row per user. Stores Google OAuth refresh token for People API / Calendar sync.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | = auth.users.id |
| `subscription_status` | text | DEFAULT 'Free' |
| `calls_analyzed_this_month` | integer | DEFAULT 0 |
| `google_refresh_token` | text | Used by google_people_service.py |
| `created_at` | timestamptz | — |

---

### `portal_sync_log`

Audit trail for batch sync runs (Drive → Supabase pipeline via `/api/v1/batch-ingest`).

| Column | Type | Notes |
|---|---|---|
| `started_at` | timestamptz | — |
| `completed_at` | timestamptz | — |
| `records_found` | integer | — |
| `records_ingested` | integer | — |
| `records_skipped` | integer | — |
| `errors` | integer | — |
| `status` | text | running/completed/failed |
| `error_details` | text | Error message if failed |

---

### `pipeline_events` *(new — 2026-05-13)*

Real-time error and lifecycle event broadcasting. Backend INSERTs here; frontend subscribes via Supabase Realtime.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | — |
| `event_type` | text | call_ingested/transcription_started/transcription_complete/transcription_failed/brief_generated/enrichment_triggered/sentinel_correction/error/info |
| `severity` | text | info/warning/error/critical |
| `source` | text | sentinel/ingestion/api/enrichment |
| `reference_id` | uuid | Optional FK to source record |
| `reference_type` | text | call_record/contact/enrichment_job |
| `message` | text | Human-readable event description |
| `detail` | jsonb | DEFAULT `'{}'` — arbitrary structured payload |
| `created_at` | timestamptz | — |

**Realtime:** Enabled (`supabase_realtime` publication). Frontend subscribes to this table to display live pipeline state without polling.

---

### `v_system_health` *(view — 2026-05-13)*

Single-query snapshot of pipeline health. Query directly in Supabase dashboard or call `GET /api/v1/system/diagnostics`.

```sql
SELECT * FROM v_system_health;
-- Returns: calls_pending, calls_processing, calls_completed, calls_error,
--          calls_stuck (>30min in processing), calls_completed_no_transcript,
--          calls_no_embedding, errors_last_24h, total_call_records, snapshot_at
```

---

### RLS Policy Audit

| Table | Policy | Roles | Assessment |
|---|---|---|---|
| `call_records` | "Enable all access for now" | public | ⚠️ No user isolation — dev mode only |
| `contacts` | "Enable all for anon" + "read for authenticated" | anon+auth | ⚠️ Anon write access — intentional for single-user, fix before multi-tenant |
| `profiles` | "Enable all for anon" | anon | ⚠️ Stores google_refresh_token — should be user-scoped |
| `enrichment_jobs` | Scoped by contact owner | public | ✅ Properly user-isolated |
| `social_signals` | Scoped by contact owner | public | ✅ Properly user-isolated |
| `user_encryption_keys` | `user_id = auth.uid()` | public | ✅ Properly user-isolated |
| `tasks`, `projects`, `attachments`, `touchpoints`, `relationships`, `entities`, `vectors` | allow_all | public | ⚠️ Open — acceptable for single-tenant |
| `pipeline_events` | allow_all | public | ℹ️ Intentionally open (internal use) |

---

## 6. Type Definitions

### Contact
```typescript
interface Contact {
  id: string;                    // UUID
  user_id?: string;
  first_name: string;
  last_name?: string | null;
  full_name?: string | null;
  phone?: string | null;         // E.164 normalized
  email?: string | null;
  organization?: string | null;
  organization_id?: string | null;
  photo_url?: string | null;
  birthdate?: string | null;     // ISO 8601 date
  notes?: string | null;
  tags?: string[];
  health_score?: number | null;  // 0–100
  is_favorite?: boolean;
  total_calls?: number | null;
  last_contact_at?: string | null;
  last_synced?: string | null;
  google_resource_name?: string | null;  // People API sync anchor
  raw_data?: Record<string, any> | null; // Full Google People payload
  created_at?: string;
  updated_at?: string;
}
```

### CallRecord
```typescript
interface CallRecord {
  id: string;
  user_id?: string;
  contact_id?: string | null;
  contact_name: string;
  phone_number?: string | null;
  duration?: string | number | null;
  timestamp: string;                    // ISO 8601
  status?: 'pending' | 'processing' | 'completed' | 'error';  // ← LOWERCASE
  raw_transcript?: string | null;       // Plain Whisper output
  transcript?: string | null;           // Processed transcript
  audio_path?: string | null;           // Local disk path
  executive_brief?: ExecutiveBrief | null;
  sentiment?: 'Positive' | 'Neutral' | 'Negative' | null;
  tags?: string[];
  recommended_followup_date?: string | null;
  draft_followup_message?: string | null;
  open_commitments?: Commitment[];
  embedding?: number[] | null;
  acr_pattern?: string;
  acr_channel?: string;
  acr_direction?: string;
  acr_phone_e164?: string;
  external_id?: string | null;
  created_at?: string;
}
```

### ExecutiveBrief
```typescript
interface ExecutiveBrief {
  title?: string;
  summary?: string;
  action_items?: string[];              // ← CANONICAL. snake_case always.
  sentiment?: 'Positive' | 'Neutral' | 'Negative';
  tags?: string[];
  category?: 'Professional' | 'Project' | 'Family';
  recommended_followup_date?: string | null;
  draft_followup_message?: string | null;
  open_commitments?: Commitment[];
}

interface Commitment {
  commitment: string;
  deadline?: string | null;
  owner?: 'user' | 'contact';
}
```

> ⚠️ **Convention:** Backend always sends `action_items` (snake_case). Zod schema back-fills from `actionItems` for legacy records. Do **NOT** add new camelCase fields.

### Task
```typescript
interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  source: 'user' | 'ai_generated' | 'ai_approved';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date?: string | null;
  project_id?: string | null;
  contact_id?: string | null;
  contact_name?: string | null;
  tags?: string[];
  ai_confidence?: number | null;
  created_at: string;
  updated_at: string;
}
```

### Project
```typescript
interface Project {
  id: string;
  title: string;
  description?: string | null;
  status: 'active' | 'on_hold' | 'completed' | 'archived';
  notes?: string | null;
  tags?: string[];
  start_date?: string | null;
  end_date?: string | null;
  created_at: string;
  updated_at: string;
}
```

### Nudge
```typescript
interface Nudge {
  id: string;
  contact_id: string;
  contact_name: string;
  reason: string;               // Human-readable nudge reason
  priority: 'high' | 'medium' | 'low';
  suggested_action?: string;
  last_contact_at?: string | null;
}
```

### EnrichmentJob
```typescript
interface EnrichmentJob {
  id: string;
  contact_id: string;
  stage: 1 | 2 | 3 | 4 | 5 | 6;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETE' | 'FAILED' | 'DEAD_LETTER';
  attempts: number;
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  result_json?: Record<string, any> | null;
  source_name?: string | null;
  error_message?: string | null;
  fetched_at?: string | null;
  created_at: string;
  updated_at: string;
}
```

### PipelineEvent
```typescript
interface PipelineEvent {
  id: string;
  event_type: 'call_ingested' | 'transcription_started' | 'transcription_complete' |
              'transcription_failed' | 'brief_generated' | 'enrichment_triggered' |
              'sentinel_correction' | 'error' | 'info';
  severity: 'info' | 'warning' | 'error' | 'critical';
  source: 'sentinel' | 'ingestion' | 'api' | 'enrichment';
  reference_id?: string | null;
  reference_type?: string | null;
  message: string;
  detail?: Record<string, any>;
  created_at: string;
}
```

### GoogleTokenResponse
```typescript
interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: 'Bearer';
}
```

### DashboardStats
```typescript
interface DashboardStats {
  status: 'success';
  totalContacts: number;
  callsThisWeek: number;
  avgHealth: number;       // 0–100
  needsAttention: number;
}
```

---

## 7. State Machines

### Call Record Pipeline

```
                    [ACR Webhook arrives]
                            │
                     INSERT call_record
                     status = 'pending'
                            │
                ┌───────────▼───────────┐
                │    Transcription       │
                │    starts (Whisper)    │
                │  status = 'processing' │
                └───────────┬───────────┘
                            │
               ┌────────────┴────────────┐
               ▼                         ▼
        [Success]                    [Failure]
    status = 'completed'          status = 'error'
    raw_transcript populated       error logged
    executive_brief populated
               │
               ▼
    [Gemini brief generated]
    executive_brief.summary populated
    action_items → tasks table
    touchpoints record created

    ← HorizonSentinel watches for stuck 'processing'
      records > 30 min and resets them to 'pending'
```

### Enrichment Job Lifecycle

```
PENDING → IN_PROGRESS → COMPLETE
                      → FAILED (attempts < 3) → back to PENDING
                      → DEAD_LETTER (attempts = 3, no retry)

Stage 1: Carrier / phone lookup
Stage 2: Social handle discovery
Stage 3: OSINT data gathering
Stage 4: Photo enrichment
Stage 5: Organization linkage
Stage 6: Synthesis → write to entities table
```

---

## 8. Real-time & SSE Events

### Supabase Realtime

Frontend subscribes to `pipeline_events` table for live error/status updates:

```typescript
supabase
  .channel('pipeline-events')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pipeline_events' },
    (payload) => handlePipelineEvent(payload.new as PipelineEvent)
  )
  .subscribe();
```

### API Server SSE Stream (`/api/v1/events/stream`)

Events are JSON lines. The frontend subscribes via `EventSource`:
```typescript
const source = new EventSource(`${API_BASE}/api/v1/events/stream`);
source.onmessage = (e) => handleEvent(JSON.parse(e.data));
```

### Inspector SSE (`/v1/inspector`)

Each event:
```json
{
  "timestamp": "2026-05-13T06:00:00Z",
  "direction": "request" | "response",
  "method": "POST",
  "path": "/v1/audio/transcriptions",
  "status": 200,
  "body_preview": "...",
  "headers": { "authorization": "***" }
}
```

---

## 9. Naming & Convention Rules

| Context | Convention | Example |
|---|---|---|
| Backend Python fields | `snake_case` | `contact_name`, `action_items` |
| Frontend TypeScript types | `camelCase` for TS, `snake_case` for API shapes | See `types/index.ts` |
| API JSON keys | `snake_case` always | Matches Python field names |
| DB column names | `snake_case` | Same as API |
| `call_records.status` | lowercase | `pending`, `processing`, `completed`, `error` |
| `call_recordings.status` | UPPERCASE | `QUEUED`, `TRANSCRIBING`, `COMPLETED`, `ERROR` |
| `enrichment_jobs.status` | UPPERCASE | `PENDING`, `IN_PROGRESS`, `COMPLETE`, `FAILED` |
| React Query keys | Array namespaced | `["contacts", "list"]` |
| Endpoint path | `/api/v1/<domain>` | Never `/api/<domain>` without version |
| Transcription endpoint | `/v1/audio` | No `/api` prefix — OpenAI compat |

---

## 10. How to Add a New Feature

1. **Define the endpoint** in `routers/<domain>.py`
2. **Register the router** in `main.py` — import AND `include_router()`. Missing either = dead endpoint.
3. **Add a method to `apiClient.ts`** — every API call goes through `ApiClient`. Never raw `fetch()` in components.
4. **Add/update the Zod schema** in `schemas/api.ts` — runtime validation catches contract drift.
5. **Add/update the TypeScript type** in `types/index.ts` — keep in sync with the schema.
6. **Add a React Query hook** in `hooks/useHorizonData.ts` — components call hooks, not `api.X()` directly.
7. **Update this document** — add the endpoint contract, table column if DB schema changed, type definition if new shape.
8. **Write a `pipeline_events` INSERT** for any async background operation so errors surface in the dashboard.

---

## 11. Known Gaps & Planned Work

| # | Gap | Status | Priority |
|---|---|---|---|
| 1 | RLS policies need user-scoping for multi-tenant readiness | Open | High (pre-launch) |
| 2 | `profiles` table stores google_refresh_token in plaintext — should reference `user_encryption_keys` | Open | High |
| 3 | `call_records` has no `transcript_encrypted`/`transcript_iv` — AES-256-GCM encryption planned in CONSTITUTION is not yet in the DB schema | Open | High |
| 4 | `socket.io-client` in production dependencies — no Socket.IO server exists | Open | Medium |
| 5 | `@google/clasp` in production dependencies — dev tool only | Open | Low |
| 6 | `v_system_health` view needs to be exposed via `/api/v1/system/health-deep` endpoint | Open | Medium |
| 7 | `pipeline_events` backend writer not yet implemented — table exists, needs Python helper function `emit_event()` | Open | High |
| 8 | Supabase Realtime subscription in frontend not wired to `pipeline_events` yet | Open | High |
| 9 | `digest.py` now registered (fixed 2026-05-13) — needs `generate_weekly_digest` in `ai_briefing_service.py` verified | Open | Medium |
| 10 | No HNSW index on `contacts.embedding` — `vectors` table has one but inline embeddings do not | Open | Medium |
| 11 | Full-text search on contacts uses GIN tsvector — but `/api/v1/contacts?search=` likely does ILIKE. Should use `to_tsquery` for performance at 2,500+ rows | Open | Medium |
| 12 | `call_recordings` (Drive pipeline catalog) is completely disconnected from `call_records` (webhook pipeline). No join exists. | Open | Medium |

---

## CORS Policy

Allowed origins (`main.py`):
- `http://localhost:5173`, `http://localhost:5174`, `http://localhost:3000`, `http://localhost:8000`, `http://localhost`
- `capacitor://localhost` ← **required for native Android WebView**
- `https://localhost`
- regex: `r"https?://localhost(:\d+)?"`

> Production: add Tailscale Funnel URL to CORS list before exposing port 8000.
