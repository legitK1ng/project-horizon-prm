# PROJECT HORIZON PRM — ENGINEERING CONSTITUTION
## Single Source of Truth | Version 3.0 | 2026-05-13

**Document classification:** Internal Engineering Reference | Single Source of Truth
**Maintained by:** Brandon
**Last updated:** 2026-05-13
**Status:** Living document — update on every meaningful architectural or design decision.

---

## 1. Project Overview

**Project Horizon PRM** is a private Relationship Intelligence Platform engineered for one user (Brandon). It captures, transcribes, diarizes, and analyzes every phone call, surfaces AI-generated executive briefs, action items, relationship health scores, and OSINT-enriched contact profiles on a local-first dashboard available on both desktop and native Android.

### Mission Statement

> Transform raw call data into relationship intelligence that tells Brandon what matters, who to contact next, and exactly what was said — processed entirely on local hardware, with zero dependence on external transcription services.

### Core Pillars

| Pillar | Description |
|--------|-------------|
| **Local-First AI** | Transcription (Faster-Whisper) and diarization (Pyannote) run on local hardware. No audio leaves the network. |
| **Zero-Lag Access** | All contact and call data is cached in IndexedDB (Dexie) so the app loads instantly without network round-trips. |
| **Self-Healing Pipeline** | The Sentinel daemon automatically detects and repairs stuck transcription records every 5 minutes. |
| **Relationship Graph** | Every call maps to a contact entity, building a timestamped intelligence timeline with AI briefs. |
| **Mobile-First** | React frontend packaged as a native Android app via Capacitor, with haptic feedback, safe-area insets, and native storage. |

### Identity

| Field | Value |
|-------|-------|
| App ID | `com.legitk1ng.horizon` |
| App Name | HorizonPRM |
| Backend Host | `hp-z2g3-mini-workstation` |
| Tailscale Device | `hp-z2g3-mini-workstation.tailb79f25.ts.net` |
| Backend Language | Python 3.11+ (FastAPI / uvicorn) |
| Frontend Language | TypeScript / React 18 |
| Database | Supabase (PostgreSQL + Realtime + RLS) |
| Mobile Framework | Capacitor 8.3.1 |
| API Version | v2.0.0 (main) / v1.0.0 (ingestion) |

---

## 2. System Architecture — Three-Zone Topology

Horizon is divided into three logical zones with strict separation of concerns.

```
┌─────────────────────────────────────────────────────────────────┐
│  ZONE 1 — THE VAULT (Persistent Storage)                        │
│  Supabase: PostgreSQL + Realtime channels + Row Level Security  │
│  Google Drive: Audio archive (Apps Script automation)           │
│  Local Disk: Processed audio cache (mcp-backend/audio/)         │
└─────────────────────────┬───────────────────────────────────────┘
                          │ Direct reads (contacts, calls, tasks)
                          │ Writes (transcripts, briefs, embeddings)
┌─────────────────────────▼───────────────────────────────────────┐
│  ZONE 2 — THE ENGINE (Python Backend)                           │
│  FastAPI API Server       → Port 8000  (main.py)                │
│  FastAPI Ingestion Server → Port 9000  (ingestion_server.py)    │
│  Horizon Supervisor       → horizon_supervisor.py               │
│  Faster-Whisper (tiny.en) — local transcription                 │
│  Pyannote 3.1 — speaker diarization                             │
│  Google Gemini — executive briefs, action items, sentiment      │
│  Google People API — contact identity resolution                │
│  HorizonSentinel — self-healing pipeline daemon (5-min cycles)  │
└─────────────────────────┬───────────────────────────────────────┘
                          │ REST /api/v1/* (Port 8000)
                          │ SSE /v1/inspector (Port 9000)
                          │ Supabase Realtime broadcast
┌─────────────────────────▼───────────────────────────────────────┐
│  ZONE 3 — THE DASHBOARD (React Frontend)                        │
│  Port 3000 dev / dist/ production / Capacitor Android build     │
│  Dexie IndexedDB + Zustand + idb-keyval (offline cache)         │
│  Guardian UI: agent panel, topology diagram, Sentinel monitor   │
│  Android: Capacitor (com.legitk1ng.horizon)                     │
└─────────────────────────────────────────────────────────────────┘
```

### Logic Decoupling Rules — Non-Negotiable

These constraints govern every PR. Violations break the architecture:

1. Zone 3 **must never** call Gemini, Whisper, Pyannote, or any ML model.
2. Zone 3 **must never** call the Google People API directly.
3. Zone 3 **may** read Supabase directly for CRUD (contacts, calls, tasks).
4. Zone 2 **owns** all AI processing. It writes finalized data to Zone 1; Zone 3 reads it.
5. Zone 1 is the **data contract boundary** between Zones 2 and 3.
6. `VITE_GEMINI_API_KEY` is intentionally absent from the frontend (enforced in `vite.config.ts`, `REQ-027`).

### Two-Server Architecture

The backend runs as **two separate FastAPI applications** — never combine them.

| Server | Port | Entry Point | CORS | Purpose |
|--------|------|-------------|------|---------|
| **API Server** | 8000 | `main.py` | Explicit origin list | All CRUD, AI chat, nudges, enrichment, sync |
| **Ingestion Server** | 9000 | `ingestion_server.py` | `allow_origins=["*"]` | Audio webhook, transcription, Sentinel, SSE inspector |

Both are managed by `horizon_supervisor.py`. Port 9000 is the only publicly-exposed endpoint via Tailscale Funnel.

---

## 3. Infrastructure & Process Supervisor

### `horizon_supervisor.py`

The supervisor is the operational backbone. It starts, monitors, and auto-restarts both backend servers.

**Full path:** `mcp-backend/horizon_supervisor.py`

**Configuration constants:**
```python
HEALTH_CHECK_INTERVAL  = 30    # seconds between health checks
MAX_RESTART_BACKOFF    = 300   # max 5 min between restarts
HEALTH_CHECK_TIMEOUT   = 10    # seconds to wait for HTTP response
TAILSCALE_FUNNEL_PORT  = 9000  # port exposed via Tailscale Funnel
```

**Server registry:**
```python
SERVERS = {
    "ingestion": {
        "module": "ingestion_server:app",
        "port": 9000,
        "health_url": "http://localhost:9000/v1/health",
        "critical": True,   # Must always be running — pipeline depends on it
    },
    "api": {
        "module": "main:app",
        "port": 8000,
        "health_url": "http://localhost:8000/api/v1/health",
        "critical": False,  # Dashboard degrades gracefully if API is down
    },
}
```

**Restart strategy (exponential backoff):**
```
backoff = min(2^restart_count, MAX_RESTART_BACKOFF)   # caps at 5 minutes
```

**Uvicorn launch flags:** `--host 0.0.0.0 --port {port} --reload --reload-dir {BACKEND_DIR}`
- Processes are started with `CREATE_NO_WINDOW` on Windows (no console window)
- Each server writes its own log: `mcp-backend/logs/{name}.log`
- Supervisor log: `mcp-backend/logs/supervisor.log`

**Windows Task Scheduler setup:**
```
Program:   C:\Users\owner\OneDrive\Desktop\horizon\.venv\Scripts\python.exe
           (use pythonw.exe for invisible background mode)
Arguments: horizon_supervisor.py
Start in:  C:\Users\owner\OneDrive\Desktop\horizon\mcp-backend
Trigger:   At startup
Setting:   Run whether user is logged on or not
```

**Tailscale Funnel:** Supervisor automatically runs `tailscale funnel 9000` on startup to expose the ingestion endpoint publicly.

### `start.ps1` — One-Command Startup

Located at project root. Executes the full startup sequence:

```powershell
# 1. Launch horizon_supervisor.py in a new PowerShell window
#    (manages API :8000 + Ingestion :9000 + Tailscale Funnel)
# 2. Launch Vite frontend: npm run dev -- --port 3000
# 3. Wait 12 seconds for initialization
# 4. Health-check all three services
# 5. Open browser at http://localhost:3000
```

**Prerequisites (first-time only):**
```powershell
python -m venv .venv
.venv\Scripts\pip install -r mcp-backend\requirements.txt
npm install
```

### `kill.ps1`

Terminates the supervisor and all child processes gracefully.

### Vite Dev Server

- **Port:** 3000 (overriding Vite's default 5173)
- **Proxy:** `/api` → `http://localhost:8000` (changeOrigin: true, secure: false)
- **Host:** `true` (LAN-accessible)
- Auto-opens browser on start

### Service URLs

| Service | Dev URL | Docs |
|---------|---------|------|
| Frontend | http://localhost:3000 | — |
| API Server | http://localhost:8000 | http://localhost:8000/docs |
| Ingestion Server | http://localhost:9000 | http://localhost:9000/v1/docs |
| SSE Inspector | http://localhost:9000/v1/inspector | — |
| Sentinel Status | http://localhost:9000/v1/sentinel/status | — |

---

## 4. Backend Architecture — Zone 2

### API Server (`main.py` — Port 8000)

**Version:** `2.0.0`
**Framework:** FastAPI with structured JSON logging and in-process rate limiting

#### Startup Sequence (lifespan)

```python
1. init_supabase()               # Initialize DB client (SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY)
2. ollama health_check()         # Non-fatal — logs warning if Ollama is unreachable
3. logger.info("API listener active. Ready.")
```

#### Middleware Stack (in order)

1. **`log_requests`** — structured JSON timing log: `{event, method, path, status, ms}`
2. **`rate_limit`** — in-process rate limiter, 120 RPM/IP (configurable via `RATE_LIMIT_RPM`). SSE streams (`/api/v1/events`) are exempt.
3. **`CORSMiddleware`** — explicit origin allowlist (see below)

#### CORS Policy

```python
CORS_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:3000",
    "http://localhost:8000",
    "http://localhost",
    "capacitor://localhost",
    "https://localhost",
]
# + regex: r"https?://localhost(:\d+)?"
# allow_credentials=True, allow_methods=["*"], allow_headers=["*"]
```

`capacitor://localhost` **must** be in this list for the native Android WebView to reach the API.

#### Router Registration (complete, authoritative list)

```python
# Core CRUD
app.include_router(health.router,         prefix="/api/v1/health",        tags=["health"])
app.include_router(auth.router,           prefix="/api/v1/auth",          tags=["auth"])
app.include_router(system.router,         prefix="/api/v1/system",        tags=["system"])
app.include_router(calls.router,          prefix="/api/v1/calls",         tags=["ingestion"])
app.include_router(contacts.router,       prefix="/api/v1/contacts",      tags=["contacts"])
app.include_router(sync.router,           prefix="/api/v1/sync",          tags=["sync"])
app.include_router(data.router,           prefix="/api/v1/data",          tags=["data"])
app.include_router(nudges.router,         prefix="/api/v1/nudges",        tags=["nudges"])
app.include_router(enrichments.router,    prefix="/api/v1/enrichments",   tags=["enrichment"])
app.include_router(ai.router,             prefix="/api/v1/ai",            tags=["ai"])
# New routers (Items 5, 11, 18)
app.include_router(ollama_router.router,  prefix="/api/v1/ollama",        tags=["ollama"])
app.include_router(actions_router.router, prefix="/api/v1/actions",       tags=["actions"])
app.include_router(events_router.router,  prefix="/api/v1/events",        tags=["events"])
# ACR / Whisper-compatible webhook (also on API server for internal use)
app.include_router(transcriptions.router, prefix="/v1/audio",             tags=["transcription"])
# Batch archive ingestion
app.include_router(batch_ingest_router.router, prefix="/api/v1/batch-ingest", tags=["batch-ingest"])
```

> **Critical:** Every new router must be both imported AND registered with `include_router`. The transcriptions router shipped dead for an extended period because the `include_router` call was missing.

#### Global Exception Handler

Catches all unhandled exceptions, returns `500 JSON` with error details, and emits a structured log event. Never exposes raw Python tracebacks to clients.

### Ingestion Server (`ingestion_server.py` — Port 9000)

**Version:** `1.0.0`
**Description:** OpenAI Whisper v1-compatible audio transcription endpoint, isolated from the API server to prevent transcription workloads from blocking CRUD operations.

#### Startup Sequence (lifespan)

```python
1. init_supabase()               # Non-blocking — runs in LOCAL-ONLY mode if DB unavailable
2. asyncio.create_task(sentinel.run())  # Starts HorizonSentinel background daemon
3. Log HORIZON_API_KEY prefix (or CRITICAL WARNING if not set)
```

**Env file guard:** Ingestion server detects null bytes in `.env` (corruption artifact) and strips them before loading.

#### Middleware Stack

1. **`InspectorMiddleware`** — MUST be added **before** CORS to capture raw requests
2. **`CORSMiddleware`** — `allow_origins=["*"]` (permissive — this server is auth-gated by API key)

#### Routes

```python
app.include_router(transcriptions.router, prefix="/v1/audio")

GET  /v1/sentinel/status   # Sentinel health metrics
GET  /v1/health            # Liveness probe + API key confirmation
GET  /v1/inspector         # SSE stream of all request/response events
```

### Inspector Middleware & SSE (`middleware/inspector.py`)

Real-time request/response inspector for live debugging.

**Architecture:**
- In-memory ring buffer stores last **200** event pairs (`deque(maxlen=200)`)
- `_subscribers: list[asyncio.Queue]` — one Queue per connected SSE client
- `_broadcast()` fan-out: pushes to all queues, prunes dead (full/disconnected) ones
- Keepalive `": keepalive\n\n"` sent every 30 seconds of silence

**`GET /v1/inspector` behavior:**
1. New client connects → replays full ring buffer history immediately
2. Then streams live events in real-time

**Security:** `Authorization` header values are masked as `***`. Binary audio bodies shown as `<binary N bytes>`.

**Exclusions:** The inspector skips `/v1/inspector` itself and `/v1/health` to prevent infinite loops.

**Binary detection heuristic:** If >10% of the first 256 bytes are non-printable, treat as binary.

### Transcription Router (`routers/transcriptions.py`)

Implements the OpenAI Whisper v1 API surface. Accepts two paths for compatibility:
- `POST /v1/audio/transcriptions` (primary)
- `POST /v1/audio/audio/transcriptions` (fallback for misconfigured clients)

#### Accepted models

```python
accepted_models = {"whisper-horizon", "whisper-1", "whisper-base", "whisper-small"}
```

#### Whisper call parameters

```python
model.transcribe(wav_path,
    beam_size=5,
    language=language or None,
    temperature=temperature,
    vad_filter=True,                   # strip silence/music
    vad_parameters=dict(
        min_silence_duration_ms=500,
        speech_pad_ms=200,
    ),
    condition_on_previous_text=False,  # prevent "oh oh oh" hallucination loops
    no_speech_threshold=0.6,           # discard low-confidence segments
    compression_ratio_threshold=2.4,   # discard repetitive/looping output
)
# Post-filter: drop segments where no_speech_prob >= 0.8
```

#### Processing flow

```
1. Validate model field (400 if unknown)
2. Parse ACR filename → extract contact_name, phone_number, call_timestamp
   (enriches form fields if they were empty — non-critical, logged as warning on failure)
3. Write audio to temp file → process_audio_ingest() → normalize to 16kHz mono WAV
4. _run_transcription() → (text, segments_list, language, duration)
5. generate_call_brief() if transcript > 50 chars
6. Write CallRecordCreate to Supabase (background task)
7. Schedule cleanup_processed_audio() (background task — runs after response sent)
8. Return verbose_json response (OpenAI-compatible format)
```

#### Response format (`verbose_json`)

```json
{
  "task": "transcribe",
  "language": "en",
  "duration": 47.3,
  "text": "Full transcript here...",
  "segments": [
    {
      "id": 0, "seek": 0, "start": 0.0, "end": 4.2,
      "text": "Hello, this is...",
      "tokens": [...], "temperature": 0.0,
      "avg_logprob": -0.23, "compression_ratio": 1.1, "no_speech_prob": 0.02
    }
  ]
}
```

### Core Engines (`mcp-backend/core/`)

#### `whisper_engine.py` — AGENT-3a (Low-level singleton)

```python
init_whisper()    # loads WhisperModel("tiny", device=..., compute_type=...)
transcribe(audio_path)  # returns list of raw segments
```

CUDA: `compute_type="int8_float16"`. CPU: `compute_type="int8"`. Falls back to CPU silently.

#### `services/transcription_service.py` — `TranscriptionManager` (High-level singleton)

```python
class TranscriptionManager:
    # Singleton via __new__ — one instance across all requests
    def get_model() -> WhisperModel  # loads on first call, cached forever

def transcribe_audio(wav_path: str) -> str  # returns clean text string
```

Model size: `os.getenv("WHISPER_MODEL_SIZE", "tiny")`. This is the override mechanism.

#### `diarization_engine.py` — AGENT-3a

```python
init_diarization()  # loads pyannote/speaker-diarization-3.1, requires HUGGINGFACE_TOKEN
diarize(audio_path)  # returns Pyannote annotation object
```

Applies `core/windows_patches.py` before pipeline load (required on Windows). CUDA used automatically.

#### `core/sentinel.py` — `HorizonSentinel`

See Section 7.

#### `core/auditor.py` — `SystemAuditor`

CLI diagnostic tool. Run directly: `python core/auditor.py`. Reports:
- Supabase connectivity + row counts for `contacts`, `call_records`
- Pipeline status (QUEUED, PROCESSING, ERROR counts)
- Environment variable presence

> **Known issue:** Checks for `OPENAI_API_KEY` which is not used by Horizon. Should check `GEMINI_API_KEY` instead.

#### `core/security/crypto.py` — AES-256-GCM Transcript Encryption

Implements REQ-037 field-level encryption for sensitive relationship data.

```python
encrypt_data(plain_text: str) -> tuple[str, str]   # (encrypted_b64, iv_b64)
decrypt_data(encrypted_b64: str, iv_b64: str) -> str
```

**Key derivation:** PBKDF2-HMAC-SHA256, 100,000 iterations, 32-byte key output.
**Key source:** `FIELD_ENCRYPTION_MASTER_KEY` env var. Falls back to a hardcoded dev key with a WARNING log.
**IV:** 12-byte random nonce per encryption (GCM standard).
**Salt:** Static `b'horizon_static_salt'` — acceptable for single-tenant deployment, must change for multi-tenant.

#### `db/supabase_client.py` — Python DB Client

```python
init_supabase() -> Client | None
get_supabase() -> Client   # raises RuntimeError if not initialized
```

**Key selection priority:** `SUPABASE_SERVICE_ROLE_KEY` → `SUPABASE_KEY` (anon). Backend operations should always use the service role key to bypass RLS.

#### `core/schemas/acr.py` — ACR Pydantic Models

```python
class ACRWebhookPayload(BaseModel):
    contact_name: str = Field("Unknown", alias="contact")
    phone_number: str = Field("", alias="phone")
    duration: Optional[str]
    duration_ms: Optional[int]
    timestamp: Optional[str]
    direction: Optional[str]    # "incoming" | "outgoing"
    note: Optional[str]
    location: Optional[str]     # "lat;lon"
    address: Optional[str]
    external_id: Optional[str]

class CallRecordCreate(BaseModel):
    # Standard fields + ACR parse metadata:
    acr_pattern: Optional[str]      # which of 14 patterns matched
    acr_channel: Optional[str]
    acr_direction: Optional[str]
    acr_phone_e164: Optional[str]   # normalized phone
    transcript_encrypted: Optional[str]
    transcript_iv: Optional[str]
    executive_brief: Optional[dict]
    embedding: Optional[List[float]]
```

### Backend Services (`mcp-backend/services/`)

| Service | Key Function(s) | Notes |
|---------|----------------|-------|
| `transcription_service.py` | `TranscriptionManager`, `transcribe_audio()` | Singleton pattern |
| `ai_briefing_service.py` | `generate_call_brief(transcript, contact)` | Returns structured dict: summary, action_items, sentiment, tags, category |
| `audio_processing_service.py` | `process_audio_ingest(content, filename)`, `cleanup_processed_audio(path)` | ffmpeg: 16kHz mono WAV |
| `batch_ingest_service.py` | Bulk processing from Google Drive | Triggered via `/api/v1/batch-ingest` |
| `consolidation_service.py` | Audio deduplication and archive organization | — |
| `embedding_service.py` | `embed_text(text)` | Google `text-embedding-004`; optional Voyage AI |
| `enrichment_service.py` | Contact enrichment orchestrator | OSINT + People API |
| `google_people_service.py` | `GooglePeopleService` class | Refresh token stored in `profiles.google_refresh_token` |
| `nudge_service.py` | Relationship health scoring, nudge trigger generation | — |
| `ollama_service.py` | `health_check()`, `DEFAULT_MODEL` | Proxies to local Ollama instance |
| `photo_enrichment_service.py` | Contact photo resolution | Via Google People API |
| `health_service.py` | Aggregated system health status | — |
| `acr_parser_reference.py` | `full_parse(path)`, `parse_acr_filename()`, `build_canonical()`, `norm_phone()` | Handles all 14 filename patterns |

### Python Dependencies (`mcp-backend/requirements.txt`)

```
fastapi, uvicorn, supabase, mcp, pydantic-settings, httpx
cryptography, python-dotenv
google-api-python-client, google-auth, google-auth-oauthlib
google-generativeai
torch
faster-whisper
pyannote.audio
```

Optional (commented out):
- `slowapi` — Redis-backed rate limiting for multi-worker production
- `voyageai` — Voyage AI embeddings (`voyage-3-large`, 1024-dim), activated by `VOYAGE_API_KEY`

---

## 5. Frontend Architecture — Zone 3

### Technology Stack

| Library | Version | Role |
|---------|---------|------|
| React | 18.3.1 | UI framework |
| TypeScript | 5.8.2 | Type safety |
| Vite | 6.2.0 | Build tool |
| React Router DOM | 7.14.0 | Client-side routing |
| TanStack Query | 5.95.2 | Server state + background sync |
| Zustand | 4.5.7 | Client state management |
| Dexie | 4.4.2 | IndexedDB ORM (local-first cache) |
| dexie-react-hooks | 4.4.0 | React bindings for Dexie |
| idb-keyval | 6.2.2 | Lightweight IndexedDB for Zustand persistence |
| Framer Motion | 12.38.0 | Animations |
| Lucide React | 0.563.0 | Icon library |
| Recharts | 2.15.0 | Charts and data visualization |
| D3 | 7.9.0 | Custom network topology visualization |
| @dnd-kit | 6.3.1 / 10.0.0 | Drag-and-drop widget grid |
| Zod | 4.3.6 | Runtime API response validation |
| Capacitor | 8.3.1 | Native Android wrapper |
| socket.io-client | 4.8.3 | WebSocket connections |
| Mermaid | 10.9.5 | Architecture diagram rendering |
| MSW | 2.12.14 | API mocking for tests |
| @tanstack/react-virtual | 3.13.24 | Virtualized list (required for 1800+ contacts) |
| @capgo/capacitor-navigation-bar | 8.1.5 | Android navigation bar control |
| react-hot-toast | 2.6.0 | Toast notifications |

### Source Directory Structure (`src/`)

```
src/
├── components/
│   ├── common/                    # Reusable UI primitives
│   │   ├── GlassCard.tsx          # Primary glassmorphism card component
│   │   ├── PremiumButton.tsx      # Styled CTA button
│   │   ├── UnifiedContactDrawer.tsx  # Contact detail slide-over
│   │   └── ...
│   ├── dashboard/                 # Dashboard-specific layout components
│   ├── widgets/                   # Draggable dashboard widgets
│   │   ├── StatsWidget.tsx        # KPI summary cards
│   │   ├── QuickActionsWidget.tsx # One-tap action buttons
│   │   ├── RecentCallsWidget.tsx  # Last N call records
│   │   ├── NudgesWidget.tsx       # Follow-up reminders
│   │   └── ContactsWidget.tsx     # Pinned contact cards
│   ├── Actions.tsx                # Action log viewer
│   ├── ActionsLog.tsx             # Audit trail component
│   ├── CallLog.tsx                # Full call history
│   ├── CommandPalette.tsx         # Keyboard-driven command bar
│   ├── Console.tsx                # System log console
│   ├── ContactList.tsx            # Virtualized contact list
│   ├── Dashboard.tsx              # Main dashboard view
│   ├── IntelligenceDossier.tsx    # Contact intelligence profile
│   ├── IntelligenceWorkbench.tsx  # AI analysis workspace
│   ├── Lab.tsx                    # Experimental features
│   ├── LoadingScreen.tsx          # App initialization screen
│   ├── Navigation.tsx             # Bottom/side navigation
│   ├── NetworkTopology.tsx        # Live system topology diagram
│   ├── Sentinel.tsx               # Frontend self-correction monitor
│   ├── SystemBots.tsx             # Guardian agent panel
│   ├── SystemStatusBar.tsx        # Top status bar (network/DB/latency/cache)
│   └── WidgetGrid.tsx             # Drag-and-drop widget layout manager
├── contexts/                      # React context providers
├── hooks/
│   ├── useHorizonData.ts          # Primary data hook (contacts, calls)
│   ├── useSystemGuardian.ts       # System health polling hook
│   └── ...
├── lib/
│   ├── db.ts                      # Dexie HorizonDB schema + table definitions
│   ├── supabase.ts                # Supabase client singleton (Capacitor-native-safe)
│   └── utils.ts                   # cn() and shared utilities
├── schemas/
│   └── api.ts                     # Zod schemas for all API responses
├── services/
│   ├── apiClient.ts               # Zod-validated HTTP client (primary)
│   ├── apiService.ts              # LEGACY — being migrated to apiClient.ts
│   ├── GuardianService.ts         # Frontend guardian orchestrator
│   ├── syncService.ts             # Supabase realtime ↔ Dexie bridge
│   └── ...
├── store/
│   ├── dataStore.ts               # Zustand + IndexedDB (contacts, calls, tasks)
│   └── guardianStore.ts           # Zustand (AI agents, mission reports)
├── types/                         # TypeScript type definitions
└── utils/
    ├── connectionLogger.ts        # Real-time connection event logger
    └── ...
```

### Supabase Client (`src/lib/supabase.ts`)

The single source-of-truth Supabase client — import from here everywhere, never instantiate directly.

**Capacitor-native storage adapter:**
- **Native (Android/iOS):** `@capacitor/preferences` (NSUserDefaults / SharedPreferences) — prevents session wipe on app backgrounding
- **Web:** Built-in `localStorage` adapter (supabase-js default)

```typescript
import { supabase } from '@/lib/supabase';
```

Custom request header sent on all requests: `x-horizon-client: horizon-prm-react`

Settings: `autoRefreshToken: true`, `persistSession: true`, `detectSessionInUrl: !isNativePlatform()`

### API Client (`src/services/apiClient.ts`)

The Zod-validated HTTP client for all FastAPI communication. **Use this, not `apiService.ts`**.

- All responses validated against `src/schemas/api.ts` before use
- Auth: `Authorization: Bearer {VITE_HZN_API_KEY}`
- `searchPerson(query)` → `GET /api/v1/contacts?search={query}&limit=20`

> `apiService.ts` is a legacy parallel service and is scheduled for deletion per the AI Chat Stabilization plan. All new components must use `apiClient.ts`.

### Schema Validation (`src/schemas/api.ts`)

Runtime Zod validation at all API response boundaries.

**`ExecutiveBriefSchema`** — normalizes `actionItems`/`action_items` dual-casing from legacy records:
```typescript
.transform((val) => ({
  ...val,
  action_items: val.action_items?.length
    ? val.action_items
    : (val as any).actionItems ?? [],
}))
```

### WidgetGrid (`src/components/WidgetGrid.tsx`)

Drag-and-drop dashboard layout. Built on `@dnd-kit/core` with touch support.

- Long-press 500ms → enter edit mode
- `PointerSensor` + `TouchSensor` for cross-platform drag
- Order persisted via `@capacitor/preferences`, key: `horizon_widget_order_v1`
- Default order: `['stats', 'quickactions', 'contacts', 'recentcalls', 'nudges']`
- Haptic feedback on drag start: `Haptics.impact({ style: ImpactStyle.Light })`

### Vite Build Configuration (`vite.config.ts`)

```typescript
server.port = 3000
server.proxy = { '/api': 'http://localhost:8000' }
build.outDir = 'dist'
build.sourcemap = true   // ⚠ See Known Gaps — disable for release
build.rollupOptions.output.manualChunks = {
  'react-vendor': ['react', 'react-dom'],
  'charts': ['recharts'],
  'icons': ['lucide-react'],
}
// define: VITE_GEMINI_API_KEY intentionally absent (REQ-027)
```

---

## 6. Local-First Data Layer

### Architecture

```
  Network / Supabase
         │
  ┌──────▼──────────┐
  │  React Query    │  Server state, background refetch
  └──────┬──────────┘
         │
  ┌──────▼──────────┐
  │  dataStore.ts   │  Zustand + idb-keyval (in-memory + IndexedDB persist)
  └──────┬──────────┘
         │
  ┌──────▼──────────┐
  │  db.ts (Dexie)  │  Full IndexedDB ORM with indexed queries
  └──────┬──────────┘
         │
  ┌──────▼──────────┐
  │  syncService.ts │  Supabase Realtime ↔ Dexie bridge
  └─────────────────┘
```

### `src/lib/db.ts` — `HorizonDB` (Dexie v4)

```typescript
class HorizonDB extends Dexie {
  contacts:     Table<Contact>     // indexes: id, last_synced
  call_records: Table<CallRecord>  // indexes: id, contact_id, timestamp
  tasks:        Table<Task>        // indexes: id, status, due_date
}
```

Provides offline-capable indexed queries without any network dependency.

### `src/store/dataStore.ts` — Zustand + idb-keyval

```typescript
interface DataState {
  contacts:         Contact[]
  callRecords:      CallRecord[]
  lastContactSync:  string | null
  lastCallSync:     string | null
  isInitializing:   boolean
  setContacts(contacts: Contact[]): void
  upsertContacts(contacts: Contact[]): void
  setCallRecords(records: CallRecord[]): void
  upsertCallRecords(records: CallRecord[]): void
  clearCache(): void
}
```

Persistence key in IndexedDB: `horizon-data-store`

### `src/services/syncService.ts` — Realtime Bridge

Two modes:

**`initialSync()`** — bulk hydration at app startup:
1. Fetch all contacts → `db.contacts.bulkPut()`
2. Fetch all call_records → `db.call_records.bulkPut()`
3. Fetch all tasks → `db.tasks.bulkPut()`

**`subscribeToUpdates()`** — live delta sync:
- Subscribes to `postgres_changes` on `contacts`, `call_records`, `tasks`
- `INSERT`/`UPDATE` → `db.{table}.put(record)` + `store.upsert*(record)`
- `DELETE` → `db.{table}.delete(id)` + filter from store

---

## 7. Guardian & Sentinel System

### Backend: `HorizonSentinel` (`core/sentinel.py`)

Autonomous asyncio background daemon running inside `ingestion_server.py`. Self-corrects the transcription pipeline every **5 minutes** (`interval_seconds=300`).

**Audit cycle (4 steps per run):**
1. Verify Supabase connectivity
2. Detect and fix stuck records (`QUEUED`/`PROCESSING` > 30 min)
3. Detect completed records with no transcript → mark `INCOMPLETE`
4. Log health summary

**Stuck record remediation logic:**

| Condition | Age | Audio | Whisper | Action |
|-----------|-----|-------|---------|--------|
| QUEUED or PROCESSING > 30 min | < 2 hours | Present | Available | Re-transcribe → `completed` |
| QUEUED or PROCESSING > 30 min | < 2 hours | Missing or unavailable | — | Reset to `QUEUED` |
| QUEUED or PROCESSING > 30 min | ≥ 2 hours | Any | Any | Mark `FAILED` (stop infinite retry) |

**Backoff on consecutive failures:** If >5 consecutive audit failures, backs off to `min(interval*2, 1800)` seconds.

**Metrics exposed at `/v1/sentinel/status`:**
```json
{
  "audits_run": 47,
  "records_fixed": 3,
  "records_errored": 1,
  "last_audit_time": "2026-05-13T...",
  "last_audit_status": "healthy",
  "consecutive_failures": 0,
  "server_start_time": "...",
  "whisper_available": true
}
```

All Sentinel operations are wrapped in `try/except` — it will never crash the ingestion server.

### Frontend: `useSystemGuardian` Hook (`src/hooks/useSystemGuardian.ts`)

Polls system health every **30 seconds**:

```typescript
interface SystemStatus {
  network:      'online' | 'offline'
  supabase:     'online' | 'offline' | 'degraded'
  latency:      number   // ms
  storageUsage: number   // localStorage usage %
}
```

### Frontend: `GuardianService` (`src/services/GuardianService.ts`)

Three concurrent loops on the frontend:

| Loop | Interval | What it does |
|------|----------|-------------|
| `startHealthCheck()` | 60s | Pings Supabase; updates `guardianStore` |
| `startAutonomousMissions()` | 30s | Randomly activates idle agents for **cosmetic UI liveliness** — no real work |
| `subscribeToLogs()` | Event-driven | Reacts to `connectionLogger` error events |

> **Important:** `startAutonomousMissions()` is **cosmetic only**. It makes agents appear active in the UI. It does not perform any real system operations. Log entries from this loop should not be treated as diagnostic signals.

### Frontend: `guardianStore` (`src/store/guardianStore.ts`)

Zustand store persisted to `localStorage` key: `horizon-guardian-store`.

**Registered AI Agents:**

| ID | Name | Role | UI Color |
|----|------|------|----------|
| a1 | AEGIS-01 | guardian | Blue |
| a2 | PATHFINDER-04 | scout | Emerald |
| a3 | NEXUS-FIXER | fixer | Amber |
| a4 | LUMINA-AI | analyst | Purple |

Agent statuses: `idle`, `scanning`, `repairing`, `optimizing`, `warning`

`MissionReport` ring buffer capped at **100** entries.

### Frontend: Guardian UI Components

| Component | Description |
|-----------|-------------|
| `SystemStatusBar.tsx` | Sticky top bar: NETWORK / SUPABASE / LATENCY / CACHE metrics |
| `SystemBots.tsx` | Agent panel with role icons, status badges, and mission log |
| `Sentinel.tsx` | Self-correction monitor with animated scan line and component health |
| `NetworkTopology.tsx` | Animated system topology: ACR Mobile → Supabase → Gemini → UI |

---

## 8. Security Architecture

### Authentication

| Layer | Mechanism | Detail |
|-------|-----------|--------|
| API Server (8000) | Bearer token | `Authorization: Bearer {HORIZON_API_KEY}` — `core/api_key_auth.py` |
| Ingestion Server (9000) | Bearer token | Same `HORIZON_API_KEY`, validated via `core/api_key_auth.py` |
| ACR Webhook (calls router) | Secret field | `Secret` form field must match `ACR_WEBHOOK_SECRET` — `core/auth.verify_acr_secret` |
| Supabase (frontend) | Anon key + RLS | `VITE_SUPABASE_ANON_KEY` — Row Level Security enforced at DB layer |
| Supabase (backend) | Service role key | `SUPABASE_SERVICE_ROLE_KEY` — bypasses RLS for backend operations |

### Transcript Encryption (REQ-037)

All transcripts are optionally encrypted at rest using AES-256-GCM before Supabase storage.

```
Key source:  FIELD_ENCRYPTION_MASTER_KEY (env var)
KDF:         PBKDF2-HMAC-SHA256, 100,000 iterations
Key length:  32 bytes (256-bit)
IV:          12-byte random nonce (per-record)
Salt:        Static b'horizon_static_salt' (single-tenant deployment)
Storage:     transcript_encrypted (base64), transcript_iv (base64) in call_records
```

**⚠️ Production requirement:** `FIELD_ENCRYPTION_MASTER_KEY` must be set. Without it, encryption falls back to a hardcoded development key and logs a WARNING.

### Network Exposure

- Only port **9000** is exposed publicly via Tailscale Funnel
- Port **8000** is LAN/VPN-only
- Frontend accesses port 8000 via Vite's `/api` dev proxy (web) or directly from native app
- The Tailscale device (`hp-z2g3-mini-workstation.tailb79f25.ts.net`) is whitelisted in `capacitor.config.ts`

---

## 9. ACR Phone Integration Pipeline

### Overview

ACR Phone (by NLLAPPS, Android) uploads recorded audio to Horizon's ingestion server via webhook, configured to mimic the OpenAI Whisper API.

### ACR C# Reference (from KNOWLEDGE2.md)

The `UploadRecordViewModel.cs` defines the exact fields the app sends:

```csharp
public class UploadRecordViewModel {
    public string   Secret   { get; set; }  // auth secret
    public string   Source   { get; set; }  // "Incoming" | "Outgoing"
    public string   Number   { get; set; }  // phone number
    public long?    Date     { get; set; }  // Unix timestamp (seconds)
    public int?     Duration { get; set; }  // call duration in seconds
    public string   Note     { get; set; }  // existing note (if any)
    public IFormFile File    { get; set; }  // audio binary
}
```

Note: ACR uses `Source` for call direction; Horizon maps this to `direction` internally.

### Webhook Configuration

| Setting | Value |
|---------|-------|
| Endpoint | `POST https://hp-z2g3-mini-workstation.tailb79f25.ts.net/v1/audio/transcriptions` |
| Auth | `Secret` field in form data must match `ACR_WEBHOOK_SECRET` in `.env` |
| Protocol | OpenAI Whisper API compatible (`multipart/form-data`) |
| Response | JSON: `{"text": "...", "note": "..."}` — `note` field updates call log in-app |

### Full Processing Pipeline

```
Stage 1 — Validation & Metadata Extraction
  • Verify HORIZON_API_KEY from Authorization header
  • Parse ACR filename with full_parse() → extract contact, phone, timestamp
    (enriches empty form fields; non-critical — logs warning on failure)

Stage 2 — Audio Preprocessing
  • Buffer UploadFile to temp bytes
  • process_audio_ingest(content, filename)
    → ffmpeg: resample to 16kHz, mono, WAV
  • Log: received N bytes

Stage 3 — Transcription (Faster-Whisper)
  • TranscriptionManager().get_model() → singleton WhisperModel
  • _run_transcription(wav_path, language, prompt, temperature)
  • VAD filter: min_silence_duration_ms=500, speech_pad_ms=200
  • Hallucination prevention: condition_on_previous_text=False
  • Post-filter: drop segments where no_speech_prob >= 0.8

Stage 4 — Executive Brief (Gemini)
  • If len(transcript) > 50: generate_call_brief(transcript, contact_name)
  • Returns: {summary, action_items, sentiment, tags, category}

Stage 5 — Identity Resolution (Google People API)
  • Check contacts table for phone_number match
  • If not found: search People API (people.searchContacts)
  • If found: use existing contact_id; if new: create contact record
  • If unknown: tag stage="New Lead" for manual triage

Stage 6 — Dual Write (background tasks)
  • INSERT call_records: transcript, executive_brief, dialogue_json, embedding
  • Supabase broadcast: "realtime:public:Touchpoints" → triggers frontend refresh
  • Cleanup temp WAV file

Stage 7 — Response to ACR
  • Return verbose_json (OpenAI-compatible)
  • "note" field = transcript (updates call log in the ACR Phone app)
  • "text" field = transcript (OpenAI parity)
```

### Security

- `ACR_WEBHOOK_SECRET` must be a high-entropy string in `mcp-backend/.env`
- Secret is never logged or included in response bodies
- All Authorization headers masked as `***` in SSE Inspector

---

## 10. AI & ML Pipeline

### Transcription — Faster-Whisper

| Parameter | Value |
|-----------|-------|
| Default model | `tiny` (override: `WHISPER_MODEL_SIZE` env var) |
| Compute type (CUDA) | `int8_float16` |
| Compute type (CPU) | `int8` |
| beam_size | 5 |
| VAD filter | Enabled (`min_silence_duration_ms=500`, `speech_pad_ms=200`) |
| Hallucination guard | `condition_on_previous_text=False`, `no_speech_threshold=0.6`, `compression_ratio_threshold=2.4` |
| Post-filter | Drop segments with `no_speech_prob >= 0.8` |

Loading pattern: Singleton — model loaded once at server startup, never reloaded per request.

### Diarization — Pyannote Audio 3.1

| Parameter | Value |
|-----------|-------|
| Model | `pyannote/speaker-diarization-3.1` |
| Token required | `HUGGINGFACE_TOKEN` (Hugging Face Hub) |
| Device | CUDA if available, else CPU |
| Windows compat | `core/windows_patches.py` applied before pipeline load |
| Speaker assignment | Based on `direction` field: outgoing = Brandon is Speaker 0; incoming = contact is Speaker 0 |

Output merged with Whisper word timestamps to produce `dialogue_json`:
```json
[{"speaker": "Brandon", "text": "Hello...", "start": 0.5, "end": 4.2}, ...]
```

### Executive Briefing — Gemini

**Service:** `services/ai_briefing_service.py` — `generate_call_brief(transcript, contact_name)`

**Output schema:**
```json
{
  "summary":      "One-sentence executive brief",
  "action_items": ["Task 1", "Task 2"],
  "sentiment":    "Positive | Neutral | Negative",
  "tags":         ["category1", "category2"],
  "category":     "Professional | Project | Family"
}
```

**Contextual AI chat** (`/api/v1/ai/chat`): If `context_id` (contact or call ID) is provided, the backend fetches `executive_brief` or `interaction_history` and injects it into Gemini's system prompt. The frontend passes `context_id` but never touches Gemini directly.

### Embeddings

- **Primary:** Google `text-embedding-004` (`embedding_service.py`)
- **Optional:** Voyage AI `voyage-3-large` (1024-dim) — activated by `VOYAGE_API_KEY`
- Stored in `call_records.embedding` as `float[]`

### Local LLM — Ollama

- Router: `GET/POST /api/v1/ollama`
- Service: `ollama_service.py` with `health_check()` at startup
- Model: `gudzenkoi/kimi-k2:1t-cloud` (remote-hosted, no local VRAM required)
- Non-fatal: API server logs warning and continues if Ollama is unreachable

---

## 11. Data Schema — The Vault

### `contacts`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | Stable UUID |
| `display_name` | text | Full name |
| `phone_number` | text | E.164 normalized |
| `email` | text | Primary email |
| `job_title` | text | From Google People API |
| `company` | text | Employer |
| `google_resource_name` | text | `resourceName` for People API sync |
| `stage` | text | CRM stage (e.g., "New Lead", "Active") |
| `relationship_score` | int | Calculated health score |
| `last_contact_at` | timestamptz | Most recent interaction |
| `created_at` | timestamptz | — |
| `updated_at` | timestamptz | — |
| `metadata` | jsonb | Flexible key-value extension |

### `call_records`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | — |
| `contact_id` | uuid FK → contacts.id | — |
| `contact_name` | text | Denormalized for read performance |
| `phone_number` | text | E.164 |
| `timestamp` | timestamptz | Call start time |
| `duration` | text | Human-readable |
| `duration_ms` | int | Machine-readable |
| `direction` | text | `incoming` / `outgoing` |
| `status` | text | `QUEUED → PROCESSING → completed / FAILED / INCOMPLETE` |
| `channel` | text | `phone` (default) |
| `transcript` | text | Full raw transcript |
| `raw_transcript` | text | Unedited Whisper output (preserved separately) |
| `transcript_encrypted` | text | AES-256-GCM ciphertext (base64) |
| `transcript_iv` | text | GCM nonce (base64) |
| `dialogue_json` | jsonb | `[{speaker, text, start, end}]` diarized array |
| `executive_brief` | jsonb | Gemini-generated structured summary |
| `sentiment` | text | `Positive / Neutral / Negative` |
| `tags` | text[] | Category tags |
| `embedding` | float[] | Semantic embedding vector |
| `audio_path` | text | Local disk path (for re-transcription by Sentinel) |
| `external_id` | text | ACR Phone's call ID |
| `acr_pattern` | text | Matched filename pattern (1–14) |
| `acr_phone_e164` | text | Normalized phone from ACR filename parse |
| `created_at` | timestamptz | — |

### `tasks`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | — |
| `contact_id` | uuid FK → contacts.id | — |
| `related_touchpoint_id` | uuid | Source call record |
| `title` | text | Task description |
| `status` | text | `pending / in_progress / completed` |
| `due_date` | timestamptz | — |
| `priority` | text | `low / medium / high` |
| `created_at` | timestamptz | — |

### `profiles`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | Auth user ID |
| `google_refresh_token` | text | OAuth refresh token for People API (`GooglePeopleService.get_refresh_token()`) |
| `settings` | jsonb | User preferences |

### Supabase Realtime Channels

| Channel | Tables Watched | Frontend Listener |
|---------|----------------|-------------------|
| `realtime:public:contacts` | contacts | INSERT, UPDATE, DELETE |
| `realtime:public:call_records` | call_records | INSERT, UPDATE, DELETE |
| `realtime:public:tasks` | tasks | INSERT, UPDATE, DELETE |
| `realtime:public:Touchpoints` | (alias — legacy name) | INSERT (from Python broadcast) |

---

## 12. API Contract — All Endpoints

### Zone 2 → Zone 3 Data Contract Rules

1. All API responses must be validated against Zod schemas in `src/schemas/api.ts` before use.
2. All fields use `snake_case`. The `actionItems`→`action_items` transform in `ExecutiveBriefSchema` handles legacy records.
3. New endpoints require a Zod schema before the frontend PR merges.
4. New features must pass the **7-Step Protocol** below.

### New Feature Protocol (7 Steps — Mandatory)

- [ ] Router created in `mcp-backend/routers/{feature}.py`
- [ ] Router **imported AND registered** with `include_router()` in `main.py` (or `ingestion_server.py`)
- [ ] Pydantic request/response models defined
- [ ] Zod schema added to `src/schemas/api.ts`
- [ ] Method added to `src/services/apiClient.ts`
- [ ] Component wired to `apiClient` (never raw `fetch`)
- [ ] Verified: browser Network tab shows request reaching correct port

### Complete Endpoint Reference

#### API Server (Port 8000)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/health` | None | Liveness probe |
| POST | `/api/v1/auth/...` | None | Google OAuth flow |
| GET/POST | `/api/v1/contacts` | Bearer | Contact CRUD |
| GET/POST | `/api/v1/calls` | ACR Secret | Call record ingest + CRUD |
| POST | `/api/v1/calls/ingest` | ACR Secret | Manual call ingest |
| GET/POST | `/api/v1/sync` | Bearer | Supabase ↔ local sync triggers |
| GET | `/api/v1/data` | Bearer | Raw data queries |
| GET | `/api/v1/nudges` | Bearer | Relationship nudge reminders |
| POST | `/api/v1/enrichments` | Bearer | Contact enrichment jobs |
| POST | `/api/v1/ai/chat` | Bearer | Gemini chat (optional context_id) |
| GET/POST | `/api/v1/system` | Bearer | System diagnostics |
| GET/POST | `/api/v1/ollama` | Bearer | Local Ollama LLM proxy |
| GET/POST | `/api/v1/actions` | Bearer | Action log / audit trail |
| GET | `/api/v1/events` | Bearer | SSE event stream (rate-limit exempt) |
| POST | `/api/v1/batch-ingest` | Bearer | Bulk audio ingestion from Drive |
| POST | `/v1/audio/transcriptions` | Bearer | ACR/Whisper-compatible (also on port 8000) |

#### Ingestion Server (Port 9000)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/v1/audio/transcriptions` | Bearer | Primary ACR webhook endpoint |
| POST | `/v1/audio/audio/transcriptions` | Bearer | Fallback path for misconfigured clients |
| GET | `/v1/health` | None | Liveness + API key confirmation |
| GET | `/v1/sentinel/status` | Bearer | Sentinel pipeline metrics |
| GET | `/v1/inspector` | Bearer | SSE request/response inspector |
| GET | `/v1/docs` | None | Interactive API docs (Swagger) |

#### Key Request/Response Contracts

**`POST /v1/audio/transcriptions`**
```
Content-Type:  multipart/form-data
Authorization: Bearer {HORIZON_API_KEY}

Form fields:
  file              (binary)  Audio blob
  model             (string)  "whisper-horizon" | "whisper-1" | ...
  language          (string)  Default: "en"
  response_format   (string)  Default: "verbose_json"
  contact_name      (string)  Default: "Unknown"
  phone_number      (string)  Caller phone
  duration          (string)  Call duration
  call_timestamp    (string)  ISO timestamp (optional)

Response: OpenAI-compatible verbose_json with "text" and "note" fields
```

**`POST /api/v1/ai/chat`**
```json
Request:  { "message": "string", "context_id": "uuid (optional)" }
Response: { "reply": "string" }
```

**`GET /api/v1/contacts`**
```
Query: ?search={query}&limit=20
Response: { "data": Contact[], "count": number }
```

---

## 13. Design System — The Look

### Brand Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `horizon-500` | `#0066ff` | Primary brand — CTAs, active states, links |
| `horizon-400` | `#3385ff` | Hover states, dark-mode interactive text |
| `horizon-600` | `#0052cc` | Pressed/active state |
| `premium-success` | `#10b981` | Success, healthy indicators |
| `premium-warning` | `#f59e0b` | Warnings, medium latency |
| `premium-error` | `#ef4444` | Errors, critical alerts |
| `slate-950` | Tailwind | Primary dark background |

> **Note:** The previous ochre accent `#B8722E` has been superseded. Current primary is horizon blue `#0066ff`.

### Typography

| Role | Font Stack | Weights |
|------|-----------|---------|
| Body / UI | `Outfit`, `Inter`, `system-ui`, `-apple-system`, `sans-serif` | 400–700 |
| Monospace | `JetBrains Mono`, `monospace` | 400–700 |
| Display headings | `font-black` Tailwind utility (900) | Used in system panels |

### Shadow Tokens

```css
shadow-xs       → var(--shadow-xs)
shadow-glow     → 0 0 40px rgba(59,130,246,0.15)
shadow-glass    → inset 0 1px 0 rgba(255,255,255,0.1), 0 8px 32px rgba(0,0,0,0.08)
shadow-xl-premium → 0 20px 40px rgba(0,0,0,0.12), 0 0 1px rgba(0,0,0,0.05)
```

### Animation Tokens

| Name | Duration | Usage |
|------|----------|-------|
| `fadeIn` | 0.3s ease-in-out | Component mount |
| `viewEnter` | 0.35s ease-out | View/route transitions |
| `shimmer` | 1.5s infinite | Loading skeletons |
| `scan` | 3s linear infinite | Sentinel scanline effect |
| `pulse-glow` | 4s ease-in-out infinite | Ambient glow |
| `pulse-dot` | 2s ease-in-out infinite | Status indicator dots |

### Glassmorphism System

Components use consistent glass styling:
- `GlassCard`: `border-horizon-500/5 shadow-premium glass-premium`
- Status bars: `bg-slate-950/90 backdrop-blur-md border-b border-white/5`
- Interactive: `shadow-glow` on hover for ambient glow
- Background accents: `bg-grid opacity-10` and `bg-carbon opacity-[0.03]`

### Layout Rules

- **Safe area:** `pt-safe` on `SystemStatusBar` for Android notch/status bar inset
- **Virtualization:** `@tanstack/react-virtual` required for any list exceeding ~100 items
- **Horizontal scroll:** `no-scrollbar` utility class on overflow-x containers
- **Dark mode:** Controlled via `darkMode: 'class'` in Tailwind config

---

## 14. Folder & File Architecture

```
project-horizon-prm/                   ← Project root
├── .env.example                        ← Template — copy to .env.local
├── .env.local                          ← GITIGNORED — frontend secrets
├── .github/
│   └── workflows/
│       └── build-apk.yml              ← CI/CD pipeline (4 jobs)
├── android/                            ← Capacitor Android project
│   ├── app/build.gradle               ← App-level Gradle (signing config)
│   ├── keystore.jks                   ← GITIGNORED — signing keystore
│   └── keystore.properties.example
├── capacitor.config.ts                 ← Capacitor config (appId, allowNavigation)
├── capacitor-horizon/                  ← Custom local Capacitor plugin
├── dist/                               ← Production web build output
├── docs/
│   ├── API_CONTRACT.md                ← Living endpoint contract
│   ├── CONSTITUTION.md                ← This document
│   ├── CONSTITUTION.docx              ← Word version
│   └── plans/
│       └── 2026-04-13-ai-chat-stabilization-design.md
├── mcp-backend/
│   ├── .env                           ← GITIGNORED — backend secrets
│   ├── main.py                        ← API server (Port 8000)
│   ├── ingestion_server.py            ← Ingestion server (Port 9000)
│   ├── horizon_supervisor.py          ← Process supervisor
│   ├── requirements.txt               ← Python dependencies
│   ├── core/
│   │   ├── api_key_auth.py            ← FastAPI auth dependency
│   │   ├── auditor.py                 ← CLI integrity checker
│   │   ├── auth.py                    ← verify_acr_secret + OAuth helpers
│   │   ├── diarization_engine.py      ← Pyannote 3.1 singleton
│   │   ├── sentinel.py                ← HorizonSentinel daemon
│   │   ├── utils.py                   ← generate_stable_uuid, norm_phone, etc.
│   │   ├── whisper_engine.py          ← Faster-Whisper singleton
│   │   ├── windows_patches.py         ← OS compat patches for Pyannote on Windows
│   │   ├── schemas/
│   │   │   └── acr.py                ← ACRWebhookPayload, CallRecordCreate
│   │   └── security/
│   │       └── crypto.py             ← AES-256-GCM encrypt_data / decrypt_data
│   ├── db/
│   │   └── supabase_client.py        ← Python Supabase client
│   ├── middleware/
│   │   └── inspector.py              ← InspectorMiddleware + SSE stream
│   ├── routers/                       ← One file per feature domain
│   │   ├── actions.py, ai.py, auth.py, batch_ingest.py, calls.py
│   │   ├── contacts.py, data.py, digest.py, enrichments.py, events.py
│   │   ├── health.py, nudges.py, ollama.py, sync.py, system.py
│   │   └── transcriptions.py
│   ├── services/                      ← Business logic layer
│   │   ├── acr_parser_reference.py   ← full_parse(), parse_acr_filename(), norm_phone()
│   │   ├── ai_briefing_service.py    ← generate_call_brief()
│   │   ├── audio_processing_service.py ← ffmpeg wrapping
│   │   ├── batch_ingest_service.py
│   │   ├── consolidation_service.py
│   │   ├── embedding_service.py      ← embed_text()
│   │   ├── enrichment_service.py
│   │   ├── google_people_service.py  ← GooglePeopleService class
│   │   ├── health_service.py
│   │   ├── nudge_service.py
│   │   ├── ollama_service.py
│   │   ├── photo_enrichment_service.py
│   │   └── transcription_service.py  ← TranscriptionManager singleton
│   └── logs/
│       ├── supervisor.log
│       ├── ingestion.log
│       └── api.log
├── AGENTS.md                          ← OpenClaw agent workspace config
├── IDENTITY.md, SOUL.md, USER.md, TOOLS.md, HEARTBEAT.md  ← Agent templates (currently empty)
├── KNOWLEDGE1.md                      ← ACR pipeline design notes
├── KNOWLEDGE2.md                      ← ACR Phone C# webhook reference code
├── PROJECT_REQS.md                    ← Master requirements list (~200 items)
├── package.json                       ← Frontend dependencies
├── src/                               ← React frontend (see Section 5)
├── start.ps1                          ← One-command full-stack startup
├── kill.ps1                           ← Graceful shutdown
├── tailwind.config.js                 ← Design tokens + custom animations
├── tsconfig.json                      ← TypeScript configuration
└── vite.config.ts                     ← Vite build + dev proxy
```

---

## 15. Environment Configuration

### Frontend (`.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | ✅ | Supabase URL (e.g., `http://localhost:54321`) |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Supabase anon/public key |
| `VITE_BACKEND_URL` | ✅ | API server URL for local dev (`http://localhost:8000`) |
| `VITE_BACKEND_URL_MOBILE` | ✅ | Tailscale Funnel URL for native builds: `https://hp-z2g3-mini-workstation.tailb79f25.ts.net` |
| `VITE_HZN_API_KEY` | ✅ | Bearer token for FastAPI (must match backend `HORIZON_API_KEY`) |
| `VITE_GOOGLE_CLIENT_ID` | ✅ | Google OAuth client ID |
| `VITE_ACR_INGEST_ENDPOINT` | optional | Override ingest path (default: `/api/v1/calls/ingest`) |

**⚠️ `VITE_GEMINI_API_KEY` is intentionally absent** — enforced by `vite.config.ts` (`REQ-027`).

### Backend (`mcp-backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | ✅ | Supabase URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ (preferred) | Service role key — bypasses RLS |
| `SUPABASE_KEY` | Fallback | Anon key — used if service role not set |
| `HORIZON_API_KEY` | ✅ | Bearer token for all API auth |
| `ACR_WEBHOOK_SECRET` | ✅ | Secret field validated from ACR Phone webhook |
| `GOOGLE_CLIENT_ID` | ✅ | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | ✅ | Google OAuth client secret |
| `HUGGINGFACE_TOKEN` | ✅ | Required for Pyannote diarization model download |
| `FIELD_ENCRYPTION_MASTER_KEY` | ✅ (production) | AES-256-GCM key material. Falls back to dev key with WARNING if unset |
| `WHISPER_MODEL_SIZE` | optional | Override Whisper model size (default: `tiny`) |
| `RATE_LIMIT_RPM` | optional | Requests per minute per IP (default: `120`) |
| `VOYAGE_API_KEY` | optional | Activates Voyage AI embeddings |
| `PORT` | optional | Override API server port (default: `8000`) |

---

## 16. Development Environment — Local Setup

### Prerequisites

| Tool | Version | Required For |
|------|---------|-------------|
| Node.js | ≥ 18.0.0 | Frontend |
| npm | ≥ 9.0.0 | Frontend |
| Python | ≥ 3.11 | Backend |
| ffmpeg | Latest | Audio preprocessing (must be in PATH) |
| CUDA Toolkit | Optional (11.8+) | GPU-accelerated Whisper + Pyannote |
| Tailscale | Latest | Funnel for webhook exposure |

### First-Time Setup

```powershell
# 1. Install frontend dependencies
npm install

# 2. Create Python virtual environment
python -m venv .venv
.venv\Scripts\pip install -r mcp-backend\requirements.txt

# 3. Frontend environment
cp .env.example .env.local
# Edit .env.local with Supabase URL/key, API keys

# 4. Backend environment
# Create mcp-backend/.env with backend secrets

# 5. Start everything
.\start.ps1
```

### Development Scripts

```json
"dev":        "vite"                               Start frontend on port 3000
"build":      "tsc && vite build"                  Type-check + production build
"type-check": "tsc --noEmit"                       TypeScript validation only
"lint":       "eslint src ... --max-warnings 0"    Zero-warning policy
"format":     "prettier --write \"src/**/*\""      Code formatting
```

### AI Chat Stabilization Plan (Active as of 2026-04-13)

1. All components using `apiService.ts` migrate to `apiClient.ts`. `apiService.ts` deleted after migration.
2. `AssistantChat.tsx` deprecated → replaced by `FloatingChat` using `/api/v1/ai/chat`.
3. Endpoint naming: `enrichment` → `enrichments` normalized across full stack.
4. Playwright E2E test regressions fixed (label mismatches).

---

## 17. Mobile Build — Android APK

### CI/CD Pipeline (`.github/workflows/build-apk.yml`)

**Node version:** 20 | **Java version:** 21 (Temurin) | **Concurrency:** cancels in-progress on new push

```
Job 1: build-web (ubuntu-latest)
  npm ci → tsc --noEmit → npm run build → upload dist/ artifact (1-day retention)

Job 2: build-debug-apk (ubuntu-latest) — needs: build-web
  Download dist/ → npx cap sync android → Gradle cache
  → gradlew assembleDebug → upload horizon-debug-{sha}.apk (14-day retention)

Job 3: build-release-apk (ubuntu-latest) — needs: build-web
  Triggers: v* tags | workflow_dispatch(build_release=true) | main push
  → Decode KEYSTORE_FILE_BASE64 → android/keystore.jks
  → gradlew assembleRelease → rename horizon-{version}.apk
  → upload artifact (90-day retention)
  → Create GitHub Release (on v* tags only, with auto-generated release notes)
  → Marks as prerelease if tag contains: -rc, -beta, -alpha

Job 4: lint (ubuntu-latest) — needs: build-web
  gradlew lintDebug → upload lint-results-debug.html (always, 7-day retention)
```

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `KEYSTORE_FILE_BASE64` | Base64-encoded `.jks` keystore file |
| `KEYSTORE_PASSWORD` | Keystore password |
| `KEY_ALIAS` | Key alias within keystore |
| `KEY_PASSWORD` | Key password |

### Capacitor Config (`capacitor.config.ts`)

```typescript
appId:   'com.legitk1ng.horizon'
appName: 'HorizonPRM'
webDir:  'dist'

server.allowNavigation: [
  '*.supabase.co', '*.supabase.com',
  'hp-z2g3-mini-workstation.tailb79f25.ts.net',
]

android.captureInput:                true
android.webContentsDebuggingEnabled: isDev   // Chrome DevTools remote debug in dev

plugins.Preferences.group: 'HorizonPRMStore'
```

**⚠️ Before production builds:** Comment out any `server.url` or `server.cleartext` temporarily added for live reload.

### Local APK Build

```bash
npm run build
npx cap sync android
cd android
./gradlew assembleDebug    # Output: app/build/outputs/apk/debug/app-debug.apk
./gradlew assembleRelease  # Requires keystore secrets
```

---

## 18. Canonical Filename Standard

All audio files are normalized to this format before storage or indexing:

```
YYYY-MM-DD_HHMMSS_[DIR]_[PHONE]_[ContactName][_chN].[ext]
```

| Segment | Description |
|---------|-------------|
| `YYYY-MM-DD` | ISO 8601 date |
| `HHMMSS` | 24h time without separators |
| `[DIR]` | `IN` or `OUT` |
| `[PHONE]` | E.164 normalized phone |
| `[ContactName]` | CamelCase, spaces → underscores |
| `[_chN]` | Optional channel suffix for stereo |
| `[ext]` | `m4a`, `mp4`, `wav`, `mp3` |

**Example:** `2026-03-14_093052_OUT_+13125551234_John_Doe.m4a`

The canonical name is produced by `build_canonical()` in `services/acr_parser_reference.py` and stored in `call_records.audio_path`.

---

## 19. Filename Patterns — All 14 Variants

ACR Phone generates filenames in different formats across app versions. The parser handles all 14:

| # | Pattern Description | Example |
|---|--------------------|----|
| 1 | Date-Time-Direction-Phone-Name | `20260314_093052_OUT_13125551234_John_Doe.m4a` |
| 2 | Date-Time-Name-Direction | `20260314_093052_John_Doe_OUT.m4a` |
| 3 | Date-Time-Phone only | `20260314_093052_13125551234.m4a` |
| 4 | Unix-Timestamp-Direction-Phone | `1710408652_OUT_13125551234.m4a` |
| 5 | ACR-prefixed-Date-Name | `ACR_20260314_093052_John_Doe.m4a` |
| 6 | Call_Direction_Date | `Call_OUT_20260314_093052.m4a` |
| 7 | RecordedCall_DateTime | `RecordedCall_20260314093052.m4a` |
| 8 | Phone-Date | `13125551234_20260314.m4a` |
| 9 | WhatsApp-style | `WA_20260314_093052_IN_John.m4a` |
| 10 | ISO datetime with T separator | `2026-03-14T09:30:52_OUT_John.m4a` |
| 11 | Natural language month | `March_14_2026_John_Doe.m4a` |
| 12 | Unix timestamp only | `1710408652.m4a` |
| 13 | Short numeric date | `140326_0930_John.m4a` |
| 14 | Fallback / unrecognized | Any remaining → flagged for manual review |

**Parser:** `services/acr_parser_reference.py` — `full_parse(path)` returns structured metadata dict including `pattern` (1–14), `canonical_name`, `contact_name`, `phone_e164`, `direction`, `datetime_str`.

---

## 20. Phone Number Normalization

All phone numbers are normalized to E.164 before any storage, query, or comparison.

### JavaScript (`src/utils/` or `src/services/`)

```javascript
function normPhone(raw) {
  const digits = raw.replace(/[^\d]/g, '');   // strip all non-digit chars
  if (digits.length === 10) return '+1' + digits;          // assume US
  if (digits.length === 11 && digits[0] === '1') return '+' + digits;
  return '+' + digits;
}
```

> **Common error:** `/\[^\d\]/g` (escaped brackets) matches literal bracket characters and fails silently. The correct regex is `/[^\d]/g` (character class).

### Python (`core/utils.py` and `services/acr_parser_reference.py`)

```python
import re

def norm_phone(raw: str) -> str:
    digits = re.sub(r'[^\d]', '', raw)
    if len(digits) == 10:
        return f'+1{digits}'
    if len(digits) == 11 and digits[0] == '1':
        return f'+{digits}'
    return f'+{digits}'
```

---

## 21. Metadata Sidecar Files

ACR Phone may produce metadata files alongside audio files. These supplement the webhook payload.

### Formats

| Extension | Format | Example content |
|-----------|--------|-----------------|
| `.properties` | Java Properties | `contact=John Doe\nphone=+13125551234\n` |
| `.json` | JSON | `{"contact": "John Doe", "phone": "+13125551234"}` |

### Pairing Rule

Sidecar files are matched to audio by **stem** (filename without extension):
- `2026-03-14_John_Doe.m4a` pairs with `2026-03-14_John_Doe.properties` or `.json`

### Data Priority (highest to lowest)

1. ACR webhook `multipart/form-data` fields
2. Sidecar file data (`.properties` / `.json`)
3. Parsed filename metadata (pattern matching)

---

## 22. Deduplication Strategy

Call records are deduplicated before insertion to prevent duplicate entries from multiple ingest paths (webhook + batch + manual).

### Primary Key

Records are identified by:
1. `external_id` — ACR Phone's unique call ID (most reliable)
2. `(phone_number + timestamp)` composite — fallback if no external_id
3. `(phone_number + duration_ms)` — last resort for historical imports

### `generate_stable_uuid` (`core/utils.py`)

Deterministic UUID generation from a stable identifier (e.g., `external_id` or composite key). Ensures the same call always produces the same database UUID, making upsert idempotent.

### Google Drive Consolidation

The `consolidation_service.py` handles deduplication of audio files in Drive before they reach the ingestion pipeline, comparing canonical names and file hashes.

---

## 23. Data Ingestion Sources

| Source | Mechanism | Frequency | Notes |
|--------|-----------|-----------|-------|
| **ACR Phone Webhook** | `POST /v1/audio/transcriptions` port 9000 | Per call (real-time) | Primary live path |
| **Google Drive Batch** | Apps Script consolidation → `/api/v1/batch-ingest` | Scheduled / on-demand | Historical backfill |
| **Manual Upload** | Frontend file picker → `/api/v1/calls/ingest` | On-demand | One-off corrections |
| **ACR Backup JSON** | `services/acrphonebackup.json` parse | One-time migration | Historical call log import |

### Google Apps Script (GAS) Pipeline

Runs in a Drive-bound context on a 10-minute trigger:

```
1. Scan: 1 Unfold(tool)/ or ACR_Audio_Raw/ for new audio files
2. Parse filename → structured metadata
3. Rename to canonical format
4. Move audio → Audio_Archive/
5. Rename sidecar → Transcripts_JSON/
6. Delete empty folders
7. Write log row to Horizon_Move_Log sheet
8. Downstream: trigger Whisper → diarization → Gemini → Supabase
```

`@google/clasp` in `devDependencies` supports deploying GAS from local source.

---

## 24. Google Drive Vault — Folder Architecture

```
Google Drive (Vault)
├── 1 Unfold(tool)/            ← Drop zone for raw audio files
├── ACR_Audio_Raw/             ← ACR Phone backup destination
├── Audio_Archive/             ← Canonical-named processed audio
├── Transcripts_JSON/          ← Sidecar metadata files
└── Horizon_Move_Log           ← Google Sheet: GAS audit log
```

The GAS pipeline moves files from drop zones into `Audio_Archive/` with canonical names and logs every operation to `Horizon_Move_Log`.

---

## 25. Audit Log Schema

The `Horizon_Move_Log` Google Sheet records every GAS pipeline operation.

| Column | Type | Description |
|--------|------|-------------|
| `timestamp` | datetime | When the operation ran |
| `original_filename` | string | File name before processing |
| `canonical_filename` | string | Renamed canonical filename |
| `pattern_matched` | string | Which of 14 patterns (e.g., "Pattern-3") |
| `phone_e164` | string | Normalized phone number |
| `contact_name` | string | Parsed contact name |
| `direction` | string | IN / OUT |
| `action` | string | RENAMED / MOVED / SKIPPED / ERROR |
| `destination_folder` | string | Where the file ended up |
| `error_message` | string | Non-null if action=ERROR |

---

## 26. Known Gaps & Shortcomings

> This section is for internal use — it does not represent intended behavior.

### Critical (Fix Required)

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| C1 | `auditor.py` checks for `OPENAI_API_KEY` (not used) | `core/auditor.py:75` | Misleading diagnostic output on every startup |
| C2 | `HUGGINGFACE_TOKEN` not in `.env.example` | `.env.example` | Diarization silently fails on fresh installs — no error until `init_diarization()` runs |
| C3 | `FIELD_ENCRYPTION_MASTER_KEY` not in `.env.example` | `.env.example` | Encryption falls back to hardcoded dev key in production |
| C4 | `apiService.ts` (legacy) and `apiClient.ts` coexist | `src/services/` | Some components bypass Zod validation |
| C5 | `VITE_BACKEND_URL_MOBILE` defined but no code path switches between it and `VITE_BACKEND_URL` | `src/services/apiClient.ts` | Native Android app hits `localhost:8000` (unreachable on device) |

### High Priority

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| H1 | Supervisor starts uvicorn with `--reload` | `horizon_supervisor.py:113` | File watcher active in production — CPU overhead, unintended restarts on any .py change |
| H2 | Sentinel re-transcription calls `_run_transcription` from `routers.transcriptions` directly — tight coupling | `core/sentinel.py:205` | Router refactors break Sentinel silently |
| H3 | Ingestion server uses `allow_origins=["*"]` | `ingestion_server.py:107` | CORS fully open — intentional but worth documenting; only safe because endpoint is API-key gated |
| H4 | `GuardianService` autonomous missions are cosmetic but log as real events | `GuardianService.ts` | Misleading log data — impossible to distinguish fake from real from logs alone |
| H5 | `socket.io-client` in dependencies — no Socket.IO server exists in the stack | `package.json` | Dead dependency, adds bundle weight (~200KB) |
| H6 | No retry or circuit-breaker in `apiClient.ts` | `src/services/apiClient.ts` | Single backend timeout causes permanent UI failure with no recovery path |

### Medium Priority

| # | Issue | Notes |
|---|-------|-------|
| M1 | `AGENTS.md`, `IDENTITY.md`, `SOUL.md`, `USER.md`, `TOOLS.md`, `HEARTBEAT.md` are all empty/template state | Noise in worktree; populate or delete |
| M2 | `msw` is in `dependencies` (not `devDependencies`) | Test tooling should be dev-only |
| M3 | `@google/clasp` is in `dependencies` (not `devDependencies`) | CLI tool, not a runtime dependency |
| M4 | `cheerio` in `dependencies` — unknown if used in frontend code | Audit if needed; move to backend if only used there |
| M5 | `build.sourcemap = true` in `vite.config.ts` | Source maps in production expose code structure; switch to `hidden` for releases |
| M6 | Playwright E2E tests have regressions from label mismatches | Per AI Chat Stabilization plan |
| M7 | `AssistantChat.tsx` and `FloatingChat` both exist | Dead component pending deletion |
| M8 | `PROJECT_REQS.md` has ~200+ items, majority marked `[To do]` — many may be complete | Needs audit to reflect current state |
| M9 | Static PBKDF2 salt in `crypto.py` | Acceptable for single-tenant; must change if multi-user |

### Fixes Applied in This Audit

| Fix | Description |
|-----|-------------|
| ✅ `transcriptions.py` router dead code | Added import + `include_router()` call in `main.py` |
| ✅ `searchPerson()` 404 | Fixed from `/api/v1/search-person` to `/api/v1/contacts?search=` |
| ✅ `actionItems` / `action_items` dual-casing | Added `.transform()` to `ExecutiveBriefSchema` |
| ✅ CORS `"*"` blocking Capacitor | Hardened to explicit origin list including `capacitor://localhost` |

---

## 27. Change Log

| Version | Date | Author | Summary |
|---------|------|--------|---------|
| 3.0 | 2026-05-13 | Claude (Cowork) | **Full worktree rescan.** Added: two-server architecture, process supervisor, local-first layer (Dexie/Zustand/idb-keyval), Guardian/Sentinel system, InspectorMiddleware SSE, AES-256-GCM transcript encryption, complete router registration table, security architecture section, Supabase realtime channel reference, WidgetGrid drag-drop spec, complete env var tables (backend + frontend), CI/CD workflow full spec, ACR C# reference model (`UploadRecordViewModel`), Whisper VAD parameters, shortcomings audit. Updated design tokens (ochre → horizon blue). |
| 2.0 | 2026-05-10 | Claude (Cowork) | Professional transformation from raw field notes. Added: full schema tables, 14 filename patterns, phone normalization, design system, APK build guide, API contract. |
| 1.0 | 2026-05-09 | Brandon | Initial field manual / raw notes (`constitution.md`) |

---

*The measure of whether this document is current: a new developer should be able to set up, operate, and extend the full Horizon stack using only this file.*
