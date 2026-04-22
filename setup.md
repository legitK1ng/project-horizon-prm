# Horizon PRM — Developer Setup Guide

This document covers everything needed to fully replicate the development environment: all environment variables, secrets, service dependencies, config file locations, and non-obvious gotchas. Keep it out of version control.

---

## Environment files

| File | Purpose |
|---|---|
| `mcp-backend/.env` | Backend secrets (Supabase, Google, enrichment APIs, etc.) |
| `.env` (project root) | Frontend env vars loaded by Vite at build time |

The root `.env` is currently a stub (one blank line). Vite reads it via `loadEnv()` in `vite.config.ts`.

### Backend — `mcp-backend/.env`

```env
# ── Supabase ──────────────────────────────────────────────────────────────────
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_KEY=<anon-key-jwt>                          # fallback when service role key is absent
SUPABASE_SERVICE_ROLE_KEY=<service-role-jwt>         # preferred — bypasses RLS for backend ops
SUPABASE_ACCESS_TOKEN=<personal-access-token>        # sbp_... token for management API (migrations, etc.)

# ── Google / Gemini (server-side only — never expose to frontend) ──────────────
GOOGLE_API_KEY=<gemini-api-key>                      # Google AI Studio → "Get API Key"
GCP_PROJECT_ID=<numeric-project-id>                  # Google Cloud project number
GOOGLE_CLIENT_ID=<oauth2-client-id>                  # Format: <numbers>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<oauth2-client-secret>          # GOCSPX-... from GCP OAuth credentials page

# ── Horizon API Key (bearer token for ACR Phone + internal API calls) ─────────
HORIZON_API_KEY=hzn_<strong-random-string>
# Generate with: python -c "import secrets; print('hzn_' + secrets.token_urlsafe(32))"
# This replaces the legacy ACR_WEBHOOK_SECRET. Old ACR_WEBHOOK_SECRET is no longer checked.

# ── Whisper (optional overrides) ──────────────────────────────────────────────
WHISPER_MODEL_SIZE=tiny                              # tiny | base | small | medium | large
# Default: tiny (fastest, ~39 MB, good enough for phone calls)
# tiny.en is English-only and slightly faster than tiny

# ── Pyannote / HuggingFace (speaker diarization) ─────────────────────────────
HUGGINGFACE_TOKEN=hf_<token>
# Required to download pyannote/speaker-diarization-3.1 on first run.
# Accept the model license at https://hf.co/pyannote/speaker-diarization-3.1 first.
# Without this token, diarization is skipped (transcription still works).

# ── Ollama (AI chat — cloud model, zero local VRAM) ───────────────────────────
OLLAMA_BASE_URL=http://localhost:11434               # default Ollama daemon address
OLLAMA_DEFAULT_MODEL=minimax-m2.7:cloud             # cloud-proxied; runs on MiniMax servers
OLLAMA_TIMEOUT_SECONDS=180

# ── Enrichment pipeline ───────────────────────────────────────────────────────
HUNTER_API_KEY=<hunter-io-api-key>                  # https://hunter.io — email enrichment
NUMVERIFY_API_KEY=<numverify-key>                   # https://numverify.com — phone lookup
CLEARBIT_API_KEY=<clearbit-key>                     # https://clearbit.com — org/person enrichment

# ── Notion (optional call-log sync) ──────────────────────────────────────────
NOTION_API_KEY=<notion-integration-token>           # ntn_...
NOTION_CALL_LOGS_DB_ID=<database-uuid>
NOTION_CONTACTS_DB_ID=<database-uuid>

# ── Field-level encryption ────────────────────────────────────────────────────
FIELD_ENCRYPTION_MASTER_KEY=<32-byte-hex-string>
# Generate with: python -c "import secrets; print(secrets.token_hex(32))"
# WARNING: Never change this value once data is encrypted. Data encrypted under
# a lost key is permanently unrecoverable.

# ── Batch ingestion ───────────────────────────────────────────────────────────
AUDIO_SOURCE_PATH=C:\Users\owner\AppData\Local\ACRPhone\Recordings
# Or wherever ACR Phone stores backups on the machine running the backend.

# ── Rate limiting ─────────────────────────────────────────────────────────────
RATE_LIMIT_RPM=120                                  # requests per minute per IP (in-process)

# ── Ports ─────────────────────────────────────────────────────────────────────
PORT=8000                                           # main FastAPI server
INGEST_PORT=9000                                    # ingestion_server.py (separate process)

# ── Optional: Voyage AI embeddings (higher quality, 1024-dim) ────────────────
# VOYAGE_API_KEY=<voyage-key>
# If set, the embedding service switches from Google text-embedding to voyage-3-large.
# After setting this for the first time, run:
#   python mcp-backend/scripts/reembed_all.py
# to re-embed all existing call records.

# ── Optional: GitHub (scripts that push data or create issues) ───────────────
# GITHUB_PERSONAL_ACCESS_TOKEN=ghp_...

# ── Optional: X/Twitter (E-006 — not yet implemented) ────────────────────────
# TWITTER_BEARER_TOKEN=
```

### Frontend — root `.env`

```env
# Only one variable is consumed by the Vite build:
VITE_BACKEND_URL=http://localhost:8000
# In production, set this to your Tailscale Funnel URL or public backend host.
# In local dev you can omit it — vite.config.ts proxies /api/** to localhost:8000.
```

Note from `vite.config.ts`: `VITE_GEMINI_API_KEY` is intentionally absent — Gemini is backend-only (REQ-027). Do not add it to the frontend env.

---

## Service dependencies

### Required

| Service | How to get it | Used for |
|---|---|---|
| Supabase project | [supabase.com](https://supabase.com) → new project | Database (all tables) |
| Google Gemini API key | [aistudio.google.com](https://aistudio.google.com) → Get API Key | Call briefs, embeddings, AI synthesis |
| FFmpeg | `winget install ffmpeg` / `brew install ffmpeg` / apt | Audio normalization to 16 kHz WAV |

### Required for specific features

| Service | Feature | Notes |
|---|---|---|
| HuggingFace token | Speaker diarization | Must accept pyannote model license first |
| Google OAuth 2.0 credentials | Google Contacts sync | Redirect URI must include `http://localhost:3000` |
| Ollama daemon | AI chat | `ollama pull minimax-m2.7:cloud && ollama serve` |
| Hunter.io API key | Email enrichment | Free tier: 25 req/month |
| Numverify API key | Phone lookup | Free tier: 100 req/month |
| Clearbit API key | Org/person enrichment | Contact Clearbit for key |

### Optional

| Service | Feature | Notes |
|---|---|---|
| Notion integration | Call log sync | Requires NOTION_API_KEY + database IDs |
| Voyage AI API key | Higher-quality embeddings | Switches from 3072-dim Google to 1024-dim voyage-3-large |
| Tailscale Funnel | Remote ACR Phone ingestion | Exposes local port 8000 to internet via Tailscale |

---

## Database setup

### Applying migrations

Run both SQL files via the Supabase Dashboard → SQL Editor, in order:

```
mcp-backend/migrations/001_actions_and_entities.sql
```
Creates: `call_logs`, `tasks`, `projects`, `entities`, vector extension (`pgvector`).

```
mcp-backend/migrations/002_call_recordings.sql
```
Creates: `call_recordings` — richer table for batch-ingested ACR archives, includes parsed filename metadata, GPS sidecar data, MD5 dedup hash, and full transcription/enrichment fields.

### Key tables

| Table | Purpose |
|---|---|
| `contacts` | Master contact record (must pre-exist; migrations assume it) |
| `call_records` | Live transcription results from ACR Phone webhook |
| `call_recordings` | Batch-ingested ACR archive records |
| `call_logs` | Normalized call log with dedup (phone + timestamp unique constraint) |
| `tasks` | Actions extracted from call briefs |
| `projects` | Project groupings for tasks |
| `entities` | OSINT-enriched entity store (JSONB) |
| `enrichment_jobs` | Per-contact enrichment pipeline state |

### pgvector

The `vector` extension must be enabled in Supabase before running migrations. It is enabled in `001_actions_and_entities.sql` with `CREATE EXTENSION IF NOT EXISTS vector`. Supabase enables it by default on most plans, but confirm under Database → Extensions in the dashboard.

### Row Level Security (RLS)

RLS policies are referenced in the codebase (REQ-040) but not yet fully implemented. The backend uses the `SUPABASE_SERVICE_ROLE_KEY` which bypasses RLS entirely, so queries work regardless of policy state. Setting up user-level RLS is a TODO.

---

## Config file locations

| File | What it controls |
|---|---|
| `mcp-backend/.env` | All backend secrets and service config |
| `.env` (root) | Frontend `VITE_BACKEND_URL` |
| `vite.config.ts` | Dev server port (3000), `/api` proxy target, build chunk splitting |
| `capacitor.config.ts` | Mobile app ID (`com.legitk1ng.horizon`), allowed navigation hosts, Tailscale domain, Preferences namespace (`HorizonPRMStore`) |
| `tailwind.config.js` | Tailwind content paths |
| `tsconfig.json` | TypeScript compiler options for `src/` |
| `tsconfig.node.json` | TypeScript options for Vite config files |

---

## Transcription pipeline details

1. ACR Phone (or any client) POSTs audio as `multipart/form-data` to `POST /v1/audio/transcriptions`.
2. The backend validates the `Authorization: Bearer hzn_<key>` header against `HORIZON_API_KEY`.
3. `audio_processing_service.py` calls FFmpeg to normalize to 16 kHz mono PCM WAV, writing to `mcp-backend/audio_ingest/temp/`.
4. `TranscriptionManager` (singleton) loads the faster-whisper model on first call. Model size is controlled by `WHISPER_MODEL_SIZE` (default: `tiny`).
5. Transcription runs on CPU (`compute_type="int8"`) by default. CUDA can be enabled by modifying the `device` variable in `transcription_service.py`.
6. The raw WAV is deleted immediately after transcription (background task via `FastAPI.BackgroundTasks`).
7. A background task calls Gemini 2.0 Flash to generate the `executive_brief` and then persists the full record to `call_records`.
8. An SSE event is broadcast to connected frontend clients on completion.

**ACR Phone model field:** ACR Phone requires the `model` form field to be one of `whisper-1`, `whisper-horizon`, `whisper-base`, or `whisper-small`. Set it to `whisper-1` in ACR's custom server settings.

---

## Ollama / AI chat setup

The AI chat assistant routes through a local Ollama daemon that proxies to `minimax-m2.7:cloud` — the model runs on MiniMax's cloud infrastructure, so no local GPU is required.

```bash
# Install Ollama: https://ollama.com/download
ollama pull minimax-m2.7:cloud
ollama serve
```

The backend health check at startup will warn (non-fatally) if Ollama is unreachable. Chat requests to `/api/v1/ai/chat` will fail with a 503 if the daemon is offline.

---

## Google OAuth setup

1. In Google Cloud Console → APIs & Services → Credentials → Create OAuth 2.0 Client ID.
2. Application type: **Web application**.
3. Authorized redirect URIs: `http://localhost:3000` (and your production URL if applicable).
4. Copy the client ID and secret into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`.
5. Enable the **Google People API** in the same project.
6. In the frontend, clicking "Connect Google Account" triggers the OAuth flow which hits `POST /api/v1/auth/google/callback`. The backend exchanges the code for tokens and stores the refresh token in Supabase against the user ID.

---

## Tailscale remote access

The `capacitor.config.ts` whitelists the Tailscale Funnel hostname `hp-z2g3-mini-workstation.tailb79f25.ts.net`. This exposes the backend to the public internet via Tailscale:

```bash
tailscale funnel 8000
```

Set `VITE_BACKEND_URL` (frontend) and ACR Phone's server URL to the Funnel hostname. Also add the hostname to `CORS_ORIGINS` in `main.py` if needed.

---

## Mobile (Capacitor) notes

- `appId`: `com.legitk1ng.horizon` — this is the Android package name and iOS bundle ID.
- The `Preferences` plugin uses namespace `HorizonPRMStore`.
- For live-reload dev builds, uncomment `server.url` in `capacitor.config.ts` and set it to `http://<dev-machine-LAN-ip>:3000` (not `localhost` — the emulator/device can't reach your machine that way).
- `webContentsDebuggingEnabled` is `true` in dev builds — connect Chrome DevTools via `chrome://inspect`.
- iOS builds: configure `NSAppTransportSecurity` in `Info.plist` to allow cleartext traffic to local/Tailscale hosts during development.

---

## Running the ingestion server (optional)

A separate ingestion server runs on port 9000 (configurable via `INGEST_PORT`):

```bash
cd mcp-backend
uvicorn ingestion_server:app --host 0.0.0.0 --port 9000 --reload
```

This is distinct from the main FastAPI app (`main.py`). It handles high-volume audio file processing independently.

---

## Python dependency notes

- `torch` is pulled in by `pyannote.audio`. On Windows, install the CPU-only build first to avoid a large CUDA download: `pip install torch --index-url https://download.pytorch.org/whl/cpu`
- `faster-whisper` requires `ctranslate2` which bundles its own native binaries. If pip install fails on Windows, ensure Visual C++ Redistributable 2019+ is installed.
- `pyannote.audio` downloads model weights from HuggingFace on first use. The `HUGGINGFACE_TOKEN` must be set and the model license must be accepted at the HuggingFace website before the download will succeed.
- Always use the venv: `source venv/bin/activate` (or `venv\Scripts\activate` on Windows) before running any Python command.

---

## Known gotchas

- **`SUPABASE_SERVICE_ROLE_KEY` vs `SUPABASE_KEY`:** The backend prefers the service role key (bypasses RLS). If only the anon key is provided, queries may fail depending on RLS policy state. Use the service role key for backend operations.
- **Windows path separators:** `audio_processing_service.py` uses `pathlib.Path` throughout. FFmpeg subprocess calls work on Windows as long as `ffmpeg.exe` is on `PATH`.
- **Whisper first-run download:** The faster-whisper model is downloaded from HuggingFace to a local cache on first use. This may take a minute. Subsequent starts are instant.
- **Port 3000 vs 5173:** `vite.config.ts` sets the dev server port to `3000`. The React app runs on 3000, not the Vite default 5174. CORS origins in `main.py` include both `5173` and `5174` as well.
- **Rate limiter is in-process:** The current rate limiter is a simple in-memory deque per IP. It resets on server restart and does not work across multiple Uvicorn workers. For production, uncomment `slowapi` in `requirements.txt` and configure Redis.
- **SSE event bus is in-process:** `routers/events.py` uses an in-memory subscriber list. Same limitation as the rate limiter — doesn't scale to multi-worker.
- **`FIELD_ENCRYPTION_MASTER_KEY` placeholder:** The default value in the repo is `horizon-prm-dev-key-replace-in-production-with-32byte-secret`. Replace this before storing any real data. The key must be exactly 32 bytes / 64 hex characters.
- **`ACR_WEBHOOK_SECRET` is legacy:** The old ACR secret-field auth is no longer checked. The `HORIZON_API_KEY` bearer token is the only active auth mechanism for the transcription endpoint.

---

## TODO (setup-related items not yet implemented)

- Docker / `docker-compose.yml` for one-command local stack (referenced in REQ-009 but not created)
- `.env.example` template file (currently must be manually constructed from this doc)
- RLS policies for `contacts`, `call_records`, and other tables (REQ-040)
- GCP Cloud Run deployment YAML (REQ-015)
- `RATE_LIMIT_RPM` Redis-backed alternative for multi-worker (noted in `main.py` comments)
