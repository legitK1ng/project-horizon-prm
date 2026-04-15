# Horizon PRM — API Contract & Communication Foundation
> **Version:** 1.0 | **Updated:** 2026-04-15
> This document is the source of truth for all backend↔frontend communication. Any new feature MUST be reflected here before or alongside its implementation.

---

## Architecture: The Zone Model

```
Zone 1 — Database (Supabase / PostgreSQL)
    ↕  Supabase SDK / SQL
Zone 2 — Python Engine (FastAPI @ localhost:8000)
    ↕  HTTP REST / JSON   ← this contract governs this boundary
Zone 3 — React Frontend (Vite @ localhost:5173)
    ↕  Capacitor bridge
Zone 4 — Mobile Device (Android / iOS)
```

**Rule:** Zone 3 never talks to Zone 1 directly. All data flows through Zone 2.

---

## Base URL

| Environment | URL |
|---|---|
| Local dev | `http://localhost:8000` |
| Mobile (Capacitor) | `http://10.0.2.2:8000` (Android emulator) or LAN IP |
| Production | Configured via `VITE_BACKEND_URL` env var |

---

## Registered Routers (as of 2026-04-15)

| Prefix | Router File | Purpose |
|---|---|---|
| `/api/v1/health` | `routers/health.py` | Readiness probe |
| `/api/v1/auth` | `routers/auth.py` | Google OAuth handshake |
| `/api/v1/system` | `routers/system.py` | Diagnostics, models list |
| `/api/v1/calls` | `routers/calls.py` | Call ingestion + list |
| `/api/v1/contacts` | `routers/contacts.py` | Full contacts CRUD |
| `/api/v1/sync` | `routers/sync.py` | Google Contacts sync |
| `/api/v1/data` | `routers/data.py` | Dashboard KPI stats |
| `/api/v1/nudges` | `routers/nudges.py` | Relationship nudges |
| `/api/v1/enrichments` | `routers/enrichments.py` | OSINT enrichment jobs |
| `/api/v1/ai` | `routers/ai.py` | Gemini chat + analysis |
| `/v1/audio` | `routers/transcriptions.py` | ACR Phone webhook (OpenAI-compatible) |

---

## Endpoint Contracts

### `GET /api/v1/health`
**Response:**
```json
{ "status": "ok", "version": "1.0.0", "db_connected": true, "whisper_ready": false }
```
Frontend expects: `status === "ok" | "healthy" | "online"` → isOnline = true

---

### `GET /api/v1/contacts`
**Query params:** `page=0`, `limit=500`, `search=<string>`, `favorites_only=false`
**Response:**
```json
{
  "status": "success",
  "data": [Contact],
  "count": 25,
  "total_count": 1822,
  "page": 0,
  "limit": 500,
  "has_more": true
}
```
Frontend uses: `res.data`, `res.total_count`, `res.has_more` for auto-pagination.
`searchPerson(query)` maps to this endpoint with `search=<query>&limit=20`.

---

### `GET /api/v1/contacts/:id`
**Response:** Single Contact object (may include live-computed `health_score`)

---

### `PATCH /api/v1/contacts/:id`
**Body:** Partial ContactUpdate (any field optional)
**Response:** Updated Contact object

---

### `PATCH /api/v1/contacts/:id/favorite`
**Response:** `{ "status": "success", "is_favorite": true }`

---

### `POST /api/v1/contacts/:id/photo`
**Body:** `{ "photo_url": "https://..." }`
**Response:** `{ "status": "success", "photo_url": "..." }`

---

### `GET /api/v1/calls`
**Response:**
```json
{ "status": "success", "data": [CallRecord], "count": 12 }
```

---

### `POST /api/v1/calls`
**Auth:** `X-ACR-Secret` header must match `ACR_WEBHOOK_SECRET` env var
**Body:** `multipart/form-data` — `file` (audio), `contact_name`, `phone_number`, `duration`, `timestamp`, `note`
**Response:** Ingested CallRecord with AI brief

---

### `GET /api/v1/data`
**Response (mapped to DashboardStats):**
```json
{
  "status": "success",
  "totalContacts": 1822,
  "callsThisWeek": 4,
  "avgHealth": 72,
  "needsAttention": 11
}
```

---

### `GET /api/v1/nudges`
**Response:** `{ "data": [Nudge] }`

---

### `POST /api/v1/nudges/refresh-all`
**Response:** `{ "status": "ok" }`

---

### `GET /api/v1/enrichments/?contact_id=<uuid>`
**Response:** `{ "data": [EnrichmentJob] }`

---

### `POST /api/v1/enrichments/`
**Body:** `{ "contact_id": "uuid" }`
**Response:** `{ "status": "queued", "job_id": "uuid" }`

---

### `POST /api/v1/ai/chat`
**Body:** `{ "message": "...", "context_id": "<contact_id|call_id|null>" }`
**Response:** `{ "message": "...", "context_used": true }`

---

### `POST /api/v1/ai/analyze`
**Body:** `{ "transcript": "..." }`
**Response:** `{ "data": ExecutiveBrief }`

---

### `POST /v1/audio/transcriptions` ← ACR Phone Webhook
**Auth:** `Secret` form field or `Authorization: Bearer hzn_<key>`
**Body:** `multipart/form-data`
- `file` — audio blob (.m4a, .mp3, .wav)
- `model` — `"whisper-1"` (required for OpenAI compat)
- `contact_name` — caller name (Horizon extension)
- `duration` — call duration string
- `call_timestamp` — ISO timestamp
**Response:** OpenAI-compatible transcription JSON + Horizon extensions

---

## Shared Type Definitions

### Contact
```typescript
interface Contact {
  id: string;           // UUID
  first_name: string;
  last_name?: string | null;
  phone?: string | null;
  email?: string | null;
  organization?: string | null;
  health_score?: number | null;  // 0–100
  is_favorite?: boolean;
  last_contact_at?: string | null;
  photo_url?: string | null;
  total_calls?: number | null;
  tags?: string[];
}
```

### CallRecord
```typescript
interface CallRecord {
  id: string;           // UUID
  contact_id: string;   // UUID → Contact
  contact_name: string;
  phone_number?: string | null;
  duration?: string | number | null;
  transcript?: string | null;
  executive_brief?: ExecutiveBrief | null;
  status?: 'QUEUED' | 'COMPLETED' | 'SKIPPED_SHORT' | 'ERROR';
  sentiment?: 'Positive' | 'Neutral' | 'Negative' | null;
  tags?: string[];
  timestamp: string;    // ISO 8601
}
```

### ExecutiveBrief
```typescript
interface ExecutiveBrief {
  title?: string;
  summary?: string;
  action_items?: string[];   // ← CANONICAL. snake_case always.
  sentiment?: 'Positive' | 'Neutral' | 'Negative';
  tags?: string[];
  recommended_followup_date?: string | null;
  draft_followup_message?: string | null;
  open_commitments?: Array<{ commitment: string; deadline?: string | null; owner?: 'user' | 'contact' }>;
}
```
> ⚠️ **Convention:** Backend always sends `action_items` (snake_case). The Zod schema back-fills from `actionItems` for legacy records. Do NOT add new camelCase fields.

---

## Naming Conventions

| Context | Convention | Example |
|---|---|---|
| Backend Python fields | `snake_case` | `contact_name`, `action_items` |
| Frontend TypeScript types | `camelCase` for TS interfaces, `snake_case` for API shapes | See types/index.ts |
| API JSON keys | `snake_case` | Always matches Python field names |
| React Query keys | Array-based namespaced | `["contacts", "list"]` |

---

## How to Add a New Feature (The Checklist)

When adding any new backend capability that the frontend will consume:

1. **Define the endpoint** in the appropriate router (`routers/<domain>.py`)
2. **Register the router** in `main.py` — if it's a new domain, add `include_router()`
3. **Add a method to `apiClient.ts`** — every API call goes through `ApiClient`, never raw `fetch` in components
4. **Add/update the Zod schema** in `schemas/api.ts` — runtime validation catches contract drift early
5. **Add/update the TypeScript type** in `types/index.ts` — keep in sync with the schema
6. **Add a React Query hook** in `hooks/useHorizonData.ts` — components never call `api.X()` directly
7. **Update this document** — add the endpoint to the table and write its contract block

---

## CORS Policy

Allowed origins (see `main.py`):
- `http://localhost:5173` (Vite dev)
- `http://localhost:5174` (Vite alt port)
- `capacitor://localhost` (Capacitor mobile wrapper)
- Any `http(s)://localhost:*` (regex catch-all for dev)

> Production: set `CORS_ORIGINS` env var or update the list in `main.py` before Cloud Run deploy.

---

## Known Gaps / Future Work

| Gap | Status | Priority |
|---|---|---|
| ACR diarization (NeMo/TitaNet) | Pending | High |
| Supabase Realtime broadcast on call complete | Not started | High |
| Google People API identity resolver | In progress | Medium |
| Confidence score on transcript | Not started | Medium |
| `/v1/audio/transcriptions` — full ACR handshake test | Needs E2E test | High |
