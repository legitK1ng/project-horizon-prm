# Horizon PRM

A self-hosted **Relationship Intelligence Platform** built to automatically capture, transcribe, and analyze phone calls — then surface proactive reminders, summaries, and health scores for every relationship that matters.

---

## What it does

Horizon turns every phone call into structured relationship intelligence. It accepts call recordings from the [ACR Phone](https://nllapps.com/apps/cb/) Android app via a local Whisper-compatible endpoint, transcribes them on-device, and stores a rich record in Supabase — complete with an AI-generated executive brief, sentiment, action items, recommended follow-up date, and open commitments. The React dashboard (also deployable as a native Android/iOS app) surfaces all of this alongside a relationship health score that decays automatically over time.

**Core features:**

- **Local call transcription** — ACR Phone POSTs recordings to `POST /v1/audio/transcriptions`, a local endpoint that mirrors the OpenAI Whisper API. Transcription runs entirely on-device via faster-whisper (no cloud transcription service required).
- **AI call briefs** — Each transcript is analyzed by Gemini 2.0 Flash to produce a structured brief: summary, sentiment, action items, follow-up date, draft follow-up message, and commitment tracking.
- **Relationship Health Score** — A per-contact score (0–100) computed from recency (40%), call frequency (30%), and sentiment (30%), with automatic decay for inactive relationships.
- **Proactive nudges** — Contacts with health scores below 40 or no contact in 21+ days are surfaced automatically on the dashboard.
- **Contact enrichment** — A 6-stage OSINT pipeline (phone lookup, email enrichment, org data, social discovery, AI synthesis) runs asynchronously per contact using Hunter.io, Numverify, and Clearbit.
- **Google Contacts sync** — Bidirectional sync with Google People API via OAuth 2.0.
- **Batch archive ingestion** — `POST /api/v1/batch-ingest` walks an ACR backup directory, parses filenames, deduplicates by MD5, and queues recordings.
- **AI chat assistant** — Contextual chat backed by Kimi K2 (via Ollama cloud proxy) with semantic search over call transcript embeddings.
- **Task & project tracking** — Actions extracted from call briefs are stored as first-class tasks, manageable through the Actions view.
- **Real-time updates** — Server-Sent Events push transcript completions, enrichment progress, and task changes to all connected clients instantly.
- **Mobile app** — The React frontend is wrapped in Capacitor for native Android and iOS deployment.

---

## Architecture

```
Zone 1 — Supabase (PostgreSQL + pgvector)
    ↕  Supabase SDK
Zone 2 — FastAPI backend  (localhost:8000)
    ↕  HTTP REST / JSON  ← governed by docs/API_CONTRACT.md
Zone 3 — React frontend   (localhost:3000)
    ↕  Capacitor bridge
Zone 4 — Mobile device (Android / iOS)
```

The frontend never talks to Supabase or any AI API directly. All data flows through the FastAPI backend, keeping credentials server-side and giving the web app and mobile app identical code paths.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| State & data fetching | Zustand, TanStack React Query v5 |
| API validation | Zod |
| Mobile wrapper | Capacitor 8 (Android + iOS) |
| Backend | FastAPI, Uvicorn, Python 3.11+ |
| Database | Supabase (PostgreSQL + pgvector extension) |
| Transcription | faster-whisper (`tiny` model, CPU by default) |
| Audio normalization | FFmpeg (16 kHz mono WAV) |
| Speaker diarization | pyannote.audio |
| AI — call briefs | Google Gemini 2.0 Flash |
| AI — chat | Kimi K2 via Ollama cloud proxy |
| Embeddings | Google Gemini Embedding 001 (switchable to Voyage AI) |
| Enrichment | Hunter.io, Numverify, Clearbit |
| Contacts sync | Google People API |
| Charts | Recharts, D3 |
| Testing | Vitest (unit), Playwright (e2e) |

---

## Project layout

```
horizon/
├── src/                          # React frontend (TypeScript)
│   ├── App.tsx                   # Router, query client, lazy-loaded routes
│   ├── components/               # UI: Dashboard, ContactList, CallLog, Actions, Console
│   ├── hooks/useHorizonData.ts   # All TanStack Query hooks
│   ├── services/apiClient.ts     # Single HTTP client class
│   ├── schemas/api.ts            # Zod schemas for all API responses
│   ├── store/                    # Zustand stores
│   └── types/index.ts            # Shared TypeScript interfaces
├── mcp-backend/                  # FastAPI backend (Python)
│   ├── main.py                   # App factory, CORS, rate limiting, router registration
│   ├── routers/                  # One file per domain (calls, contacts, ai, transcriptions, …)
│   ├── services/                 # Business logic: transcription, enrichment, AI briefing, …
│   ├── core/                     # Auth, Whisper engine, diarization engine
│   ├── db/supabase_client.py     # Supabase singleton
│   ├── migrations/               # SQL migrations (apply via Supabase Dashboard)
│   └── requirements.txt          # Python dependencies
├── docs/
│   └── API_CONTRACT.md           # Authoritative backend↔frontend endpoint contract
├── capacitor.config.ts           # Mobile app config (app ID, allowed hosts)
├── vite.config.ts                # Dev server (port 3000, /api proxy to :8000) + build
└── package.json
```

---

## Quick start

### Prerequisites

- Node.js ≥ 18, npm ≥ 9
- Python ≥ 3.11
- FFmpeg on your PATH (`ffmpeg -version` should work)
- A Supabase project (free tier is fine)
- Google Cloud project with Gemini API enabled

### 1. Frontend

```bash
npm install
```

### 2. Backend

```bash
cd mcp-backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Environment variables

Create `mcp-backend/.env` with at minimum:

```env
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-jwt>
GOOGLE_API_KEY=<gemini-api-key>
HORIZON_API_KEY=hzn_<any-strong-random-string>
```

See `setup.md` for the full variable reference.

### 4. Database migrations

Run both files in order via the Supabase Dashboard → SQL Editor:

```
mcp-backend/migrations/001_actions_and_entities.sql
mcp-backend/migrations/002_call_recordings.sql
```

### 5. Run

```bash
# Terminal 1 — backend
cd mcp-backend && uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2 — frontend
npm run dev
```

The dashboard opens at `http://localhost:3000`. API docs are at `http://localhost:8000/docs`.

---

## ACR Phone setup

To stream live call recordings from your Android phone:

1. Install [ACR Phone by NLL Labs](https://nllapps.com/apps/cb/) on Android.
2. In ACR Phone → Settings → Cloud Backup → Custom Server:
   - **URL:** `http://<your-machine-ip>:8000/v1/audio/transcriptions`
     (use a Tailscale Funnel URL for remote access)
   - **API key:** the value of `HORIZON_API_KEY` from your `.env`
   - **Model:** `whisper-1`
3. Make a test call. The transcript and brief will appear in the dashboard within ~60 seconds depending on call length.

---

## Mobile build

```bash
npm run build
npx cap sync android
npx cap open android       # opens Android Studio
```

For live reload during development, uncomment and update the `server.url` line in `capacitor.config.ts`.

---

## Notes

- The Whisper model is loaded into memory on the first transcription and stays resident. On CPU, a 5-minute call transcribes in roughly 30–90 seconds depending on hardware. Override the model size with `WHISPER_MODEL_SIZE` (`tiny` → `base` → `small` → `medium` → `large`).
- Gemini (briefs, embeddings) and Kimi K2 (chat) require internet access. The transcription pipeline itself is fully offline.
- Rate limiting defaults to 120 requests/minute per IP. Adjust with `RATE_LIMIT_RPM`.
- The in-memory SSE event bus and rate limiter are single-worker only. For multi-worker production deployments, replace both with Redis-backed implementations (noted in the source).
- Do not change `FIELD_ENCRYPTION_MASTER_KEY` once data is encrypted in Supabase — there is no recovery path for data encrypted under a lost key.

---

## License

Private — Project Horizon. Not licensed for redistribution.
