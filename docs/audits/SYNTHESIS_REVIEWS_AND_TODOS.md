# Project Horizon PRM — Master Engineering Reviews, Audits, To-Dos & Operational Pearls Synthesis

> **Generated:** 2026-10-26  
> **Synthesized By:** Subagent 1 (Engineering Reviews, Audits & Action-Items Synthesizer)  
> **Corpus Scope:** 633 deduplicated files across all 9 Horizon directories (`Desktop_horizon`, `Desktop_unsorted`, `Eclipse_unsorted`, `Horizon_root`, `Imports_Surface3_WP`, `Imports_legitk1ng`, `New folder`, `Users_Horizon_dot_agent`, `Users_Horizon_dot_agents`)  
> **Primary Live Codebase Audited:** `Desktop_horizon` (`C:\Users\legitk1ng\Desktop\horizon`)

---

## Executive Overview

Across the 9 workspace snapshots, Project Horizon evolved through four distinct engineering epochs:
1. **Epoch 1 — Legacy Cloud Run / Notion / 40-REQ Prototype (`New folder`, `Horizon_root`):** Built around `master_prompt_legacy.md` (REQ-001 to REQ-040), Google Cloud Run, and early Notion/Supabase dual-sync ideas.
2. **Epoch 2 — Two-Server FastAPI + ACR Phone Webhook Gateway (`Imports_Surface3_WP`, `Imports_legitk1ng`, `Eclipse_unsorted`):** Introduced the split between **Port 8000** (`main.py`, REST API) and **Port 9000** (`ingestion_server.py`, Tailscale Funnel ACR receiver), Faster-Whisper + Pyannote 3.1.1 diarization on the HP Z2G3 Mini (`100.76.83.52`), and the OpenClaw multi-agent orchestration layer (`openclaw-tasks.md`, `horizon_kanban.html`).
3. **Epoch 3 — Automated Engineering Reviews & Constitution v3.0/v4.0 (`Desktop_horizon/docs/reviews/*`, `CONSTITUTION.md`, `CONSTITUTION_PATCHES.md`, `API_CONTRACT.md`):** Identified critical stability issues (17 zombie Python processes on Port 9000, Node.js v25.8.0 Vite build segfaults, Pyannote 4.0 `torchcodec` crashes on Windows, AES-256-GCM encryption gaps, and schema mismatches) and applied 6 rounds of automated fixes (`ENGINEERING_FIXES_APPLIED_2026-06-21` through `2026-06-23_01-14`).
4. **Epoch 4 — Local-First Dexie.js Architecture & August 2026 Reorganization (`Desktop_horizon`):** Added `src/db/localDb.ts` and `src/services/syncService.ts` (30-second outbox/pull sync) and reorganized the repository (`REORG_MANIFEST.json`, `2026-08-16`). **Crucially, the August 2026 reorganization introduced two new path regressions by moving `horizon_supervisor.py` and `ingestion_server.py` from `mcp-backend/` into `scripts/` without updating their relative paths/imports.**

---

## SECTION 1: Master Unresolved Bugs & Technical Debt Ledger

Every bug, security flaw, schema mismatch, race condition, and edge case found across all audit reports has been verified directly against the live code in `Desktop_horizon`.

### Status Legend
- **STILL OPEN** — Confirmed present and unfixed in `Desktop_horizon`.
- **REGRESSED / BROKEN BY REORG** — Previously fixed, but broken by the `2026-08-16` directory reorganization (`REORG_MANIFEST.json`) or unmerged staging files.
- **PARTIALLY FIXED** — Mitigated or partially patched, with residual defects remaining in `Desktop_horizon`.
- **FIXED** — Confirmed resolved in `Desktop_horizon` live code.

---

### 1.1 Backend / FastAPI (`mcp-backend/` & `scripts/`)

| ID / Source | Bug / Technical Debt Description | Live File & Line Reference (`Desktop_horizon`) | Verification Details & Exact Defect | Status |
| :--- | :--- | :--- | :--- | :--- |
| **REORG-01**<br>*(New Discovery — `REORG_MANIFEST.json`)* | **`horizon_supervisor.py` moved from `mcp-backend/` to `scripts/`, breaking `BACKEND_DIR` and `cwd`** | `scripts/horizon_supervisor.py:50` | Line 50 sets `BACKEND_DIR = Path(__file__).parent.resolve()`, which now resolves to `Desktop_horizon\scripts` instead of `Desktop_horizon\mcp-backend`. When `ManagedProcess.start()` runs `python -m uvicorn main:app` with `cwd=str(BACKEND_DIR)` (line 135), `main:app` fails immediately with `ModuleNotFoundError: No module named 'main'`, and `LOG_DIR = BACKEND_DIR / "logs"` writes to `scripts/logs`. Fix: set `BACKEND_DIR = Path(__file__).resolve().parent.parent / "mcp-backend"`. | **REGRESSED / BROKEN BY REORG** |
| **REORG-02**<br>*(New Discovery — `REORG_MANIFEST.json`)* | **`ingestion_server.py` moved from `mcp-backend/` to `scripts/`, breaking internal imports and `.env` loading** | `scripts/ingestion_server.py:21-24, 34-40, 74` | `ingestion_server.py` loads `.env` via `os.path.join(os.path.dirname(__file__), ".env")` (looking in `scripts/.env` instead of `mcp-backend/.env`) and imports `from middleware.inspector import ...`, `from routers import transcriptions`, `from services.scanner_router import router`, `from db.supabase_client import init_supabase`, `from core.security.verify_key import verify_encryption_key`. Running from `scripts/` fails with `ModuleNotFoundError` unless `mcp-backend` is on `sys.path` and `.env` path points to `mcp-backend/.env`. | **REGRESSED / BROKEN BY REORG** |
| **CALLS-ENC-01**<br>*(`pipeline-notes.md` F-01 / Audit)* | **AES-256-GCM encryption in `routers/calls.py` is a dead no-op; ciphertext is computed and discarded** | `mcp-backend/routers/calls.py:169, 219-240` | Line 169 calls `transcript_encrypted, transcript_iv = encrypt_data(transcript)`. However, the `record = {...}` dictionary constructed at lines 219–240 omits both `transcript_encrypted` and `transcript_iv` and only writes plaintext `"transcript": transcript` to `call_records`. | **STILL OPEN** |
| **CALLS-ENC-02**<br>*(`pipeline-notes.md` / Audit)* | **`list_calls` in `routers/calls.py` imports `decrypt_data` inside the loop but never calls it** | `mcp-backend/routers/calls.py:268-285` | Line 268 executes `from core.security.crypto import decrypt_data` on every iteration of `for record in (res.data or []):`, never calls `decrypt_data()`, and line 274 reads `record.get("transcript") or record.get("raw_transcript")`. Meanwhile `routers/transcriptions.py:737` sets `"raw_transcript": "[ENCRYPTED]"` when encryption is active, so encrypted records return literal `"[ENCRYPTED]"` in the UI. | **STILL OPEN** |
| **CALLS-ASYNC-01**<br>*(`pipeline-notes.md` F-02 / Audit)* | **Synchronous CPU-bound Whisper, Gemini, and Embedding calls block the FastAPI asyncio event loop in `routers/calls.py`** | `mcp-backend/routers/calls.py:156, 217, 636` | Unlike `transcriptions.py` (which uses `loop.run_in_executor` for `run_transcription`), `calls.py` calls `transcribe_audio(wav_path)` (line 636), `generate_call_brief(transcript, ...)` (line 156), and `embed_text(...)` (line 217) synchronously inside `async def` endpoints, freezing Port 8000 for 10–120+ seconds per call. Also, `transcriptions.py:537` calls `generate_call_brief()` synchronously inside `async def _process_pipeline`. | **STILL OPEN** |
| **SENTINEL-ASYNC-01**<br>*(`CONSTITUTION_PATCHES.md` PATCH-05 / H2)* | **`HorizonSentinel._attempt_fix()` calls `TranscriptionManager().run_transcription()` synchronously inside an `async` loop** | `mcp-backend/core/sentinel.py:194` | While `C9`/`H2` was fixed by decoupling `sentinel.py` from `routers/transcriptions.py` and calling `TranscriptionManager().run_transcription(audio_path)`, line 194 calls it synchronously without `await asyncio.get_running_loop().run_in_executor(None, ...)`, blocking the Port 9000 event loop whenever Sentinel self-heals a stalled job. | **PARTIALLY FIXED** |
| **ENV-MISMATCH-01**<br>*(`pipeline-notes.md` F-04 / C1)* | **`core/auditor.py` checks `GEMINI_API_KEY`, but AI services read `GOOGLE_API_KEY`** | `mcp-backend/core/auditor.py:30`<br>`mcp-backend/services/ai_briefing_service.py`<br>`mcp-backend/services/embedding_service.py` | `C1` was patched so `auditor.py` no longer checks `OPENAI_API_KEY`; it now checks `GEMINI_API_KEY` (line 30). However, `ai_briefing_service.py` and `embedding_service.py` read `os.getenv("GOOGLE_API_KEY")` (with fallback in `config.py`). If only one is set in `.env`, either `auditor.py` reports `DEGRADED` or AI services fail. | **PARTIALLY FIXED** |
| **PROC-LOCK-01**<br>*(`EMERGENCY_FIX_SCRIPTS.md` Fix #2 / `IMMEDIATE_ACTION_ITEMS.md`)* | **No PID file lock (`core/process_lock.py`) to prevent duplicate Port 9000 `ingestion_server` instances** | `mcp-backend/core/` (missing `process_lock.py`)<br>`scripts/ingestion_server.py` | On `2026-06-21`, **17 zombie Python processes** accumulated on Port 9000 because `--reload` spawned child processes without a singleton PID lock. `--reload` was gated behind `PRODUCTION=true` in `horizon_supervisor.py:58` (`PATCH-01`), but `core/process_lock.py` from `EMERGENCY_FIX_SCRIPTS.md` was never created. | **PARTIALLY FIXED** |
| **CORS-01**<br>*(`API_CONTRACT.md` §11 Gap #12)* | **`ingestion_server.py` uses `allow_origins=["*"]` with `allow_credentials=True`** | `scripts/ingestion_server.py:50-56` | Browsers reject `Access-Control-Allow-Origin: *` when `Access-Control-Allow-Credentials: true`, and wildcard CORS on a public Tailscale Funnel endpoint is overly permissive compared to `main.py`'s explicit origin whitelist. | **STILL OPEN** |
| **RATE-LIMIT-01**<br>*(`API_CONTRACT.md` §11 Gap #11)* | **Zero rate-limiting (`slowapi`) on any endpoint across Port 8000 or Port 9000** | `mcp-backend/main.py`<br>`scripts/ingestion_server.py` | Neither server has rate-limiting middleware; `/api/v1/ai/*` and `/api/v1/search/semantic` can exhaust Gemini API quotas if called in a tight loop. | **STILL OPEN** |
| **AUTH-BYPASS-01**<br>*(`API_CONTRACT.md` §2.1)* | **Missing `HORIZON_API_KEY` in `.env` silently disables authentication across all Port 8000 routes** | `mcp-backend/core/auth.py:42-45` | If `HORIZON_API_KEY` is unset or empty, `verify_api_key` logs a warning and returns `None` (allowing all unauthenticated traffic through). | **STILL OPEN** |
| **C1 / C2 / C3 / PATCH-07**<br>*(`CONSTITUTION.md` §26)* | **Startup encryption key verification (`verify_key.py`) and `auditor.py` env checks** | `mcp-backend/core/security/verify_key.py:1-58`<br>`mcp-backend/core/auditor.py:25-33` | `verify_encryption_key()` runs a startup canary round-trip test and halts on invalid `FIELD_ENCRYPTION_MASTER_KEY`; `auditor.py` no longer references `OPENAI_API_KEY`. | **FIXED** |

---

### 1.2 ACR Ingestion, Whisper & Pyannote Diarization (`mcp-backend/routers/transcriptions.py`, `services/transcription_service.py`, `Imports_Surface3_WP`)

| ID / Source | Bug / Technical Debt Description | Live File & Line Reference (`Desktop_horizon`) | Verification Details & Exact Defect | Status |
| :--- | :--- | :--- | :--- | :--- |
| **VRAM-01 / PATCH-06**<br>*(`CONSTITUTION_PATCHES.md` PATCH-06 / `M1`)* | **GPU serial execution lock vs hardcoded CPU fallback on HP Z2G3 Mini (Quadro M620 2GB VRAM)** | `mcp-backend/services/transcription_service.py:815-824` | `TranscriptionManager.get_model()` in `services/transcription_service.py` hardcodes `device = "cpu"` and `compute_type="int8"`, ignoring CUDA even if available, while `core/whisper_engine.py` and `core/diarization_engine.py` exist as separate modules. Furthermore, the explicit `del model; gc.collect(); torch.cuda.empty_cache()` serial GPU handoff prescribed by `PATCH-06` is not integrated into `TranscriptionManager.run_transcription()`. | **STILL OPEN** |
| **INGEST-DEDUP-01**<br>*(`pipeline-notes.md` F-05 / F-08)* | **Two competing ingestion pipelines (`calls.py` vs `transcriptions.py`) write different columns and use incompatible deduplication** | `mcp-backend/routers/calls.py:55-260`<br>`mcp-backend/routers/transcriptions.py:346-795` | `calls.py` (`POST /api/v1/calls/ingest` & `/webhook/acr` on Port 8000) writes plaintext `transcript`, `embedding`, and `executive_brief` to `call_records` with no deduplication check. `transcriptions.py` (`POST /v1/audio/transcriptions` on Port 9000) uses a 3-tier deduplication check (`source_filename`, `audio_hash` SHA-256, and `(phone_number, call_timestamp)` ±120s window) and writes `raw_transcript="[ENCRYPTED]"`, `transcript_encrypted`, `transcript_iv`. | **STILL OPEN** |
| **INGEST-SYNC-BRIEF-01**<br>*(`pipeline-notes.md` F-06)* | **`_process_pipeline` in `transcriptions.py` awaits `generate_call_brief()` synchronously without `run_in_executor`** | `mcp-backend/routers/transcriptions.py:537` | Inside `async def _process_pipeline()`, line 537 calls `brief = generate_call_brief(raw_text, contact_name=contact_name)` directly on the asyncio event loop instead of offloading to an executor thread. | **STILL OPEN** |
| **SCANNER-CONCURRENCY-01**<br>*(`pipeline-notes.md` F-10)* | **Watchdog folder scanner (`scanner_service.py`) has no concurrency semaphore when bulk files drop into `incoming_calls/`** | `mcp-backend/services/scanner_service.py` | Dropping multiple audio recordings into `incoming_calls/` simultaneously triggers concurrent background tasks without an `asyncio.Semaphore(1)` queue, risking OOM on the 2GB VRAM / bare-metal host. | **STILL OPEN** |
| **BUG-01 to BUG-11**<br>*(`Imports_Surface3_WP/ACR_Gateway_Session_Log.md`)* | **Surface3 Standalone ACR Gateway (`C:\ACR-Gateway`) Session Bugs (`BUG-01` through `BUG-11`)** | `Imports_Surface3_WP/ACR_Gateway_Session_Log.md` | In the standalone Surface3 gateway: `BUG-01` (wrong IP `192.168.68.68`), `BUG-02` (PowerShell `$host` collision), `BUG-03` (missing `python-multipart`), `BUG-04` (Tailscale Funnel TLS handshake timeout — fixed via `tailscale serve --bg 8000` + `tailscale funnel --bg 443`), `BUG-05` (missing `torchaudio`), `BUG-06` (`pyannote.audio 4.0.4` `torchcodec` DLL crash on Windows — fixed by pinning `pyannote.audio==3.1.1` + `huggingface_hub<1.0`), `BUG-07` (`soundfile` missing FLAC/MP4 — fixed via `av` PyAV decoding), `BUG-08` (`use_auth_token` deprecated), `BUG-09` (placeholder `HF_TOKEN=hf_YOUR_HUGGINGFACE_TOKEN_HERE` — **STILL OPEN** on Surface3), `BUG-10` (`POST /` 405 Method Not Allowed from ACR test button), `BUG-11` (`001_add_acr_transcripts_table.sql` not yet executed in Supabase — **STILL OPEN**). | **9 FIXED / 2 STILL OPEN (`BUG-09`, `BUG-11`)** |

---

### 1.3 Supabase / Database Schema & Dexie Local-First Sync

| ID / Source | Bug / Technical Debt Description | Live File & Line Reference (`Desktop_horizon`) | Verification Details & Exact Defect | Status |
| :--- | :--- | :--- | :--- | :--- |
| **SCHEMA-TASKS-01**<br>*(`API_CONTRACT.md` §5 & §11 Gap #4 / `database_schema_analysis.md`)* | **`transcriptions.py` inserts `related_call_id` into `tasks`, which does not exist in Supabase `tasks` table** | `mcp-backend/routers/transcriptions.py:766-783` | Line 773 builds `task_rows` with `"related_call_id": record_id` and `"source": "ai_brief"`. The live Supabase `tasks` table (`id, contact_id, title, due_date, priority, status, description, created_at, updated_at`) has **neither `related_call_id` nor `source`** (and `CONSTITUTION.md` §11 referred to `related_touchpoint_id`). Every action-item insert throws a PostgREST column error, caught and swallowed as a warning at line 783 (`Action item insert failed (non-fatal)`). | **STILL OPEN** |
| **SCHEMA-ENC-01**<br>*(`API_CONTRACT.md` §11 Gap #3 / `database_schema_analysis.md`)* | **`transcriptions.py` writes `transcript_encrypted` and `transcript_iv` to `call_records`, which are missing from the baseline Supabase table schema** | `mcp-backend/routers/transcriptions.py:738-739`<br>`docs/API_CONTRACT.md:1076` | Unless a manual `ALTER TABLE call_records ADD COLUMN transcript_encrypted text, ADD COLUMN transcript_iv text;` migration is executed against Supabase, `_persist_to_db()` fails with `PGRST204` when `FIELD_ENCRYPTION_MASTER_KEY` is active. | **STILL OPEN** |
| **SCHEMA-LOGS-01**<br>*(`API_CONTRACT.md` §11 Gap #1 & #2)* | **`call_logs` and `system_logs` tables referenced in code/docs do not exist in live Supabase** | `mcp-backend/routers/calls.py:28`<br>`docs/API_CONTRACT.md:1070-1075` | `call_logs` was superseded by `call_records` (5,873 rows) + `call_recordings` (5,817 rows). `system_logs` was superseded by `pipeline_events` (`002_horizon_sentinel_tables.sql`). Any legacy query hitting `call_logs` or `system_logs` returns `PGRST205`. | **STILL OPEN (Doc/Legacy Drift)** |
| **SCHEMA-CASING-01**<br>*(`API_CONTRACT.md` §11 Gap #6 / `CONSTITUTION.md` §11)* | **Inconsistent `status` enum casing across Supabase tables (`call_records` vs `call_recordings` & `enrichment_jobs`)** | `mcp-backend/routers/transcriptions.py:740`<br>`docs/API_CONTRACT.md:1084` | `call_records.status` uses **lowercase** (`'pending'`, `'transcribed'`, `'completed'`, `'failed'`), whereas `call_recordings.status` and `enrichment_jobs.status` use **UPPERCASE** (`'PENDING'`, `'PROCESSING'`, `'COMPLETED'`, `'FAILED'`). | **STILL OPEN** |
| **RLS-01**<br>*(`API_CONTRACT.md` §6 / `database_schema_analysis.md`)* | **Row-Level Security (RLS) disabled or missing policies on core tables (`call_records`, `call_recordings`, `contacts`, `touchpoints`)** | `docs/API_CONTRACT.md:942-975`<br>`docs/database_schema_analysis.md` | `interactions`, `Interaction_Staging`, `relationship_Vitals`, and `source_registry` have RLS enabled with **0 policies** (blocking all `anon` key reads), while `call_records` (5,873 rows) and `contacts` (1,622 rows) have RLS **disabled**, exposing all rows if the `anon` key is ever used directly from the browser. | **STILL OPEN** |
| **DEXIE-SYNC-01**<br>*(`src/services/syncService.ts`)* | **Dexie `syncService.ts` pulls contacts/calls/tasks/nudges every 30s without incremental `updated_at` cursor** | `src/services/syncService.ts:116-175` | `pullFromRemote()` fetches `/api/v1/contacts`, `/api/v1/calls`, `/api/v1/tasks`, and `/api/v1/nudges` and runs `localDb.*.bulkPut()` every 30 seconds without passing a `?since=<last_sync_timestamp>` delta parameter. | **STILL OPEN** |

---

### 1.4 Frontend / UI / TypeScript (`src/`, `Desktop_unsorted/horizon-changed-files/`, `Desktop_unsorted/logs/`)

| ID / Source | Bug / Technical Debt Description | Live File & Line Reference (`Desktop_horizon`) | Verification Details & Exact Defect | Status |
| :--- | :--- | :--- | :--- | :--- |
| **RESCUE-BUG-03**<br>*(`Claud_Rescue_summary.md` Bug #3)* | **`NudgeShelf.tsx` passes `nudge.id` instead of `nudge.contact_id` to `handleRefresh()`** | `src/components/common/NudgeShelf.tsx:20, 71` | Line 20 defines `const handleRefresh = async (contactId: string) => { await refreshHealth(contactId); }`, which calls `POST /api/v1/nudges/refresh/{contact_id}`. However, line 71 binds `onClick={() => handleRefresh(nudge.id)}` instead of `nudge.contact_id`! The fix exists in `Desktop_unsorted/horizon-changed-files/src/components/common/NudgeShelf.tsx:66` (`nudge.contact_id ?? nudge.id`) but was **never merged into `Desktop_horizon`**. | **STILL OPEN (Fix unmerged in `horizon-changed-files`)** |
| **RESCUE-BUG-04**<br>*(`Claud_Rescue_summary.md` Bug #4 / `API_CONTRACT.md` §11 Gap #7)* | **Zod `SentimentSchema` rejects mixed-case sentiment values (`'Positive'`, `'Neutral'`, `'Negative'`, `'Critical'`) returned by backend** | `src/schemas/api.ts:25` | In `Desktop_horizon/src/schemas/api.ts:25`, `SentimentSchema = z.enum(['POSITIVE', 'NEUTRAL', 'NEGATIVE', 'URGENT'])`. Backend `ai_briefing_service.py` returns `'Positive' | 'Neutral' | 'Negative' | 'Critical'`. Zod validation fails and drops call records! The fix in `Desktop_unsorted/horizon-changed-files/src/schemas/api.ts:25-29` (`z.enum(['POSITIVE', 'NEUTRAL', 'NEGATIVE', 'URGENT', 'Positive', 'Neutral', 'Negative', 'Urgent', 'Critical']).transform(...)`) was **never merged into `Desktop_horizon`**. | **STILL OPEN (Fix unmerged in `horizon-changed-files`)** |
| **RESCUE-BUG-05**<br>*(`Claud_Rescue_summary.md` Bug #5)* | **Zod `TouchpointSchema` requires non-null `contact_id: z.string().uuid()`, crashing on unmatched ACR calls** | `src/schemas/api.ts:73` | In `Desktop_horizon/src/schemas/api.ts:73`, `TouchpointSchema` defines `contact_id: z.string().uuid()` without `.nullable().optional()`. Unmatched incoming calls have `contact_id: null`, causing `TouchpointListSchema.safeParse()` to reject the entire `/api/v1/calls` response! The fix in `Desktop_unsorted/horizon-changed-files/src/schemas/api.ts:78` (`z.string().uuid().nullable().optional()`) was **never merged into `Desktop_horizon`**. | **STILL OPEN (Fix unmerged in `horizon-changed-files`)** |
| **RESCUE-BUG-06**<br>*(`Claud_Rescue_summary.md` Bug #6)* | **`RelationshipGraph.tsx` never attaches `d3.zoom()` to the SVG element, breaking Zoom In / Out / Reset controls** | `src/components/common/RelationshipGraph.tsx:59-64, 195-210` | Lines 195–210 call `d3.select(svgRef.current).transition().call(d3.zoom<SVGSVGElement, unknown>().scaleBy, 1.3)`, which creates a brand-new unattached zoom behavior instance and fails because no zoom behavior was registered via `svg.call(zoom)` during initialization! The fix in `Desktop_unsorted/horizon-changed-files/src/components/common/RelationshipGraph.tsx` (`zoomRef`) was **never merged into `Desktop_horizon`**. | **STILL OPEN (Fix unmerged in `horizon-changed-files`)** |
| **RESCUE-BUG-01 / 02 / 07**<br>*(`Claud_Rescue_summary.md` Bugs #1, #2, #7)* | **Google Sync endpoint (`POST /api/v1/sync/google`), Dashboard `executive_brief?.summary` fallback, and `IntelligenceWorkbench.tsx` ingestion hook** | `src/components/common/GoogleSyncButton.tsx`<br>`src/components/Dashboard.tsx:70-71`<br>`src/components/IntelligenceWorkbench.tsx:16, 52` | Verified in `Desktop_horizon`: `GoogleSyncButton.tsx` uses OAuth code exchange + `POST /api/v1/sync/google` (matching `routers/sync.py:17`); `Dashboard.tsx:70` reads `tp.executive_brief?.summary || tp.summary`; `IntelligenceWorkbench.tsx` uses `useIngestCall()`. *(Note: Do NOT overwrite these 3 files with the older `horizon-changed-files` versions—only cherry-pick Bugs #3, #4, #5, #6!)* | **FIXED** |
| **FE-SEC-01**<br>*(`pipeline-notes.md` F-03 / Audit)* | **Hardcoded `'X-ACR-Secret': 'horizon-secret-handshake'` in `src/services/apiClient.ts`** | `src/services/apiClient.ts:291` | `ingestCall()` in `apiClient.ts` hardcodes `'X-ACR-Secret': 'horizon-secret-handshake'` in client-side code instead of relying on `this.getHeaders()` (`X-Horizon-Key` / `Bearer`). | **STILL OPEN** |
| **GUARDIAN-SIM-01 / C8 / H4**<br>*(`CONSTITUTION_PATCHES.md` PATCH-04)* | **`GuardianService.ts` inner `setInterval` inside `executeMission()` not tracked in `this.intervals` array; `.hzn-guardian-event--sim` badge not rendered** | `src/services/GuardianService.ts:68-105`<br>`src/components/SystemBots.tsx` | `startAutonomousMissions()` was renamed to `startMissionSimulation()` with a `COSMETIC_ONLY` docstring, and `dispose()` clears `this.intervals`. However, the inner `const interval = setInterval(...)` inside `executeMission()` (line 75) is never pushed to `this.intervals` (so an in-flight mission interval can outlive `dispose()`), and `SystemBots.tsx` does not render the `.hzn-guardian-event--sim` `[SIM]` badge. | **PARTIALLY FIXED** |
| **FE-DEPS-01 / M2 / M4**<br>*(`CONSTITUTION.md` §26 M2, M4)* | **`msw`, `cheerio`, and `@google/generative-ai` remain in production `dependencies` in `package.json`** | `package.json:15, 19, 25` | While `socket.io-client` (`C4`/`H5`) was removed and `@google/clasp` (`C7`/`M3`) was moved to `devDependencies`, `cheerio` (`^1.0.0-rc.12`), `msw` (`^2.12.10`), and `@google/generative-ai` (`^0.24.1`) are still listed under production `dependencies` in `Desktop_horizon/package.json`. | **PARTIALLY FIXED** |
| **TS-ERR-01**<br>*(`Desktop_unsorted/logs/tsc_output.txt` & `ts_errors.txt`)* | **Historical TypeScript errors in `CommandPalette.tsx` (`exactOptionalPropertyTypes` with `cmdk`) and `Lab.tsx` (`ProvenanceItem` properties)** | `src/components/common/CommandPalette.tsx`<br>`src/components/Lab.tsx`<br>`tsconfig.json` | Logged in `Desktop_unsorted/logs/ts_errors.txt`: `CommandPalette.tsx` had `exactOptionalPropertyTypes: true` conflicts with `cmdk` children/value props, and `Lab.tsx` accessed `selectedItem.confidence`, `.source`, `.verifiedAt` on `ProvenanceItem`. (`tsconfig.json` in `Desktop_horizon` mitigated strictness flags, though type definitions in `Lab.tsx` should be kept aligned). | **PARTIALLY FIXED** |
| **DESIGN-TOKEN-DRIFT-01**<br>*(`DESIGN_TOKENS.md` v4.0 §12)* | **Hardcoded Tailwind hex/slate classes vs `--hzn-*` semantic CSS tokens (`#B8722E` Warm Ochre vs `#0066FF` Blue)** | `docs/DESIGN_TOKENS.md:1-60`<br>`src/components/*.tsx` | `DESIGN_TOKENS.md` v4.0 overruled Constitution v3.0's accidental `#0066FF` "Horizon Blue" and restored `#B8722E` (Warm Ochre light) / `#E8A656` (Amber Gold dark). Several components (`IntelligenceWorkbench.tsx`, `SystemBots.tsx`, `Lab.tsx`) still use hardcoded Cyber-Noir Tailwind classes (`bg-slate-950`, `text-indigo-400`, `border-slate-800`) rather than `--hzn-*` CSS variables. | **PARTIALLY FIXED** |

---

### 1.5 Mobile / Capacitor (`capacitor.config.ts`, `android/`, `src/services/apiClient.ts`)

| ID / Source | Bug / Technical Debt Description | Live File & Line Reference (`Desktop_horizon`) | Verification Details & Exact Defect | Status |
| :--- | :--- | :--- | :--- | :--- |
| **CAP-URL-01 / C5**<br>*(`CONSTITUTION.md` §26 C5)* | **Dynamic switching between `VITE_BACKEND_URL` and `VITE_BACKEND_URL_MOBILE` via `Capacitor.isNativePlatform()`** | `src/services/apiClient.ts:31-35` | Fixed in `Desktop_horizon/src/services/apiClient.ts`: `const BASE_URL = Capacitor.isNativePlatform() ? BACKEND_NATIVE : BACKEND_WEB;` routes native Android traffic to `https://hp-z2g3-1.tail84647d.ts.net` and web dev traffic to `http://localhost:8000`. | **FIXED** |
| **CAP-SYNC-01**<br>*(`PROJECT_REQS.md` Stage 4)* | **Android build artifacts (`npx cap sync android`) & Tailscale VPN background connectivity check** | `capacitor.config.ts`<br>`android/` | `npx cap sync android` must be re-run after every production `npm run build` (`dist/`), and mobile clients outside the LAN require Tailscale Android VPN active (or Tailscale Funnel routed to Port 8000 if REST API access off-Tailnet is desired). | **STILL OPEN (Operational Step)** |

---

### 1.6 Tailscale / Infrastructure / Environment (`HP Z2G3 Mini`, `Surface3`, `Node.js`, `Python venvs`)

| ID / Source | Bug / Technical Debt Description | Live File & Line Reference (`Desktop_horizon`) | Verification Details & Exact Defect | Status |
| :--- | :--- | :--- | :--- | :--- |
| **NODE-CRASH-01**<br>*(`CRITICAL_UPDATE_2026-06-21_03-15.md`)* | **Node.js v25.8.0 (unstable odd-numbered release) segfaults (`0xC0000005` Access Violation) during Vite/Rollup production builds** | Host OS Environment (`node -v`) | Node.js v25.8.0 crashes during `npm run build` / `tsc` due to V8 memory management bugs on Windows. `vite.config.ts` was patched with `reportCompressedSize: false` and `sourcemap: mode !== 'production'`, and `package.json` uses `--max-old-space-size=8192`, but the host Node binary should be downgraded to **Node.js v22.17.0 LTS** (or v20 LTS). | **PARTIALLY FIXED (Workaround in `package.json` / `vite.config.ts`)** |
| **STORAGE-AUDIT-01**<br>*(`STORAGE_AUDIT_ADDENDUM.md` / `BACKEND_VENV_FIX_REQUIRED.md`)* | **Duplicate Python virtual environments (`mcp-backend/venv` 2.66 GB vs `mcp-backend/.venv` 0.37 GB) & root clutter** | `mcp-backend/` (Host Disk) | `STORAGE_AUDIT_ADDENDUM.md` documented 3.55 GB of redundant virtual environments (`venv` with PyTorch/Whisper vs `.venv` with FastAPI/Supabase) and 850 MB in `node_modules`. Standardize on a single consolidated venv in `mcp-backend/.venv` (or `venv`) with all `requirements.txt` packages installed. | **STILL OPEN (Host Environment)** |
| **TAILSCALE-FUNNEL-PORT-01**<br>*(`CONSTITUTION.md` §3 & §6 vs `ACR_Gateway_Session_Log.md`)* | **Tailscale Funnel Port Target Contention (Port 9000 `ingestion_server.py` vs Port 8000 `main.py` / Surface3)** | Tailscale CLI (`tailscale funnel status`) | On `hp-z2g3-1.tail84647d.ts.net`, public Tailscale Funnel (`https://...:443`) must point to **Port 9000** (`ingestion_server.py`) for ACR Phone webhook ingestion, while **Port 8000** (`main.py`) stays restricted to the Tailnet mesh (`100.76.83.52:8000`). Note: Tailscale Funnel on Windows requires `tailscale serve --bg 9000` followed by `tailscale funnel --bg 443` to avoid TLS handshake timeouts (`BUG-04`). | **DOCUMENTED / OPERATIONAL** |

---

## SECTION 2: Master Actionable To-Do & Roadmap Ledger

This section consolidates every actionable task across all planning documents, review action-item lists, OpenClaw agent queues, Kanban boards, and requirements specifications.

---

### 2.1 Immediate Critical Engineering Fixes (Priority 0 — Execute First)

1. **[P0-1] Fix `scripts/horizon_supervisor.py` and `scripts/ingestion_server.py` Post-Reorg Path Regressions (`REORG-01`, `REORG-02`):**
   - Either move `horizon_supervisor.py` and `ingestion_server.py` back into `mcp-backend/` (matching `CONSTITUTION.md` §4 & `STRUCTURE.md`), **OR** update `BACKEND_DIR = Path(__file__).resolve().parent.parent / "mcp-backend"` in `scripts/horizon_supervisor.py:50` and add `sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "mcp-backend"))` + correct `.env` path in `scripts/ingestion_server.py`.
2. **[P0-2] Cherry-Pick the 4 Unmerged Claude Rescue Fixes into `Desktop_horizon/src/` (`RESCUE-BUG-03` to `06`):**
   - `src/components/common/NudgeShelf.tsx:71`: Change `handleRefresh(nudge.id)` → `handleRefresh(nudge.contact_id ?? nudge.id)`.
   - `src/schemas/api.ts:25`: Update `SentimentSchema` to accept Title-Case (`'Positive'`, `'Neutral'`, `'Negative'`, `'Critical'`) and normalize to uppercase via `.transform(s => s.toUpperCase())`.
   - `src/schemas/api.ts:73`: Update `TouchpointSchema.contact_id` to `z.string().uuid().nullable().optional()`.
   - `src/components/common/RelationshipGraph.tsx`: Create `zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)`, attach `svg.call(zoom)` on init, and use `zoomRef.current.scaleBy` / `zoomRef.current.transform` in the zoom buttons.
3. **[P0-3] Fix `routers/calls.py` Broken Encryption & Event-Loop Blocking (`CALLS-ENC-01`, `CALLS-ENC-02`, `CALLS-ASYNC-01`):**
   - Include `"transcript_encrypted": transcript_encrypted` and `"transcript_iv": transcript_iv` in `routers/calls.py` `record` dict (or route all ingestion through `TranscriptionManager`), and call `decrypt_data(record["transcript_encrypted"], record["transcript_iv"])` in `list_calls()`.
   - Wrap synchronous `transcribe_audio()`, `generate_call_brief()`, and `embed_text()` calls in `await loop.run_in_executor(None, ...)` across `routers/calls.py`, `routers/transcriptions.py:537`, and `core/sentinel.py:194`.
4. **[P0-4] Resolve Supabase Schema Drift (`SCHEMA-TASKS-01`, `SCHEMA-ENC-01`, `BUG-11`):**
   - Run a migration on Supabase adding `transcript_encrypted TEXT` and `transcript_iv TEXT` to `call_records`, adding `related_call_id UUID REFERENCES call_records(id)` and `source TEXT` to `tasks`, and applying `001_add_acr_transcripts_table.sql` + `002_horizon_sentinel_tables.sql` if not yet present.
5. **[P0-5] Unify `GOOGLE_API_KEY` vs `GEMINI_API_KEY` (`ENV-MISMATCH-01`) & Remove Hardcoded Frontend Secret (`FE-SEC-01`):**
   - Update `mcp-backend/core/auditor.py` to accept either `GEMINI_API_KEY` or `GOOGLE_API_KEY`.
   - Remove hardcoded `'X-ACR-Secret': 'horizon-secret-handshake'` from `src/services/apiClient.ts:291`.

---

### 2.2 OpenClaw Node & Multi-Agent Tasks (`Eclipse_unsorted/openclaw-tasks.md`)

From `openclaw-tasks.md` (6 Master Tasks, 26 Sub-Steps for OpenClaw autonomous execution):

- **Task 1: Project Cleanup & File Organization**
  - `1.1` Create `archive/` directory (`archive/legacy-scripts`, `archive/temp-outputs`, `archive/reviews`).
  - `1.2` Move legacy utility scripts (`check_*.py`, `inspect_*.py`, `find_*.py`, `diag_*.py`, `list_*.py`, `verify_*.py`, `final_*.py`, `apply_migration.py`) to `archive/legacy-scripts/`. *(Completed in `Desktop_horizon` reorg)*.
  - `1.3` Move temporary debug outputs (`*.txt`, `*.log`, `*.html` dumps) to `archive/temp-outputs/`. *(Completed in `Desktop_horizon` reorg)*.
  - `1.4` Move `horizon_kanban.html` to `docs/` and historical review `.md` files to `archive/reviews/`. *(Completed in `Desktop_horizon/docs/reviews/archive/`)*.
  - `1.5` Create root `STRUCTURE.md` documenting directory layout. *(Completed in `Desktop_horizon/STRUCTURE.md`)*.
- **Task 2: Environment Configuration & Validation**
  - `2.1` Inspect `.env.example` and compare against all `os.getenv()` calls in `mcp-backend/`.
  - `2.2` Ensure `.env` exists in root and `mcp-backend/.env` with valid `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_API_KEY` / `GEMINI_API_KEY`, `HORIZON_API_KEY`, `ACR_WEBHOOK_SECRET`, `HUGGINGFACE_TOKEN`, `FIELD_ENCRYPTION_MASTER_KEY`.
  - `2.3` Run `python -m core.auditor` (or `GET /api/v1/system/Diagnostics`) to verify all env vars pass.
  - `2.4` Test Supabase connectivity (`init_supabase()`).
- **Task 3: Database Schema Verification & Migration**
  - `3.1` Verify existence and column structure of all core Supabase tables (`contacts`, `call_records`, `call_recordings`, `touchpoints`, `tasks`, `nudges`, `enrichment_jobs`, `push_tokens`, `pipeline_events`, `system_alerts`).
  - `3.2` Apply pending migrations in `mcp-backend/migrations/` (`001_enable_pgvector.sql`, `002_horizon_sentinel_tables.sql`, plus `transcript_encrypted`/`transcript_iv` and `tasks.related_call_id`).
  - `3.3` Verify `match_call_records` and `match_contacts` pgvector RPC functions exist in Supabase.
  - `3.4` Audit and configure Supabase Row-Level Security (RLS) policies.
- **Task 4: Backend Services Verification & Startup**
  - `4.1` Consolidate Python virtual environment (`mcp-backend/.venv`) and install `requirements.txt`.
  - `4.2` Verify `python -m py_compile` passes on all files in `mcp-backend/` and `scripts/`.
  - `4.3` Start Port 8000 (`main.py`) and verify `GET /api/v1/health` returns `200 OK`.
  - `4.4` Start Port 9000 (`ingestion_server.py`) and verify `GET /health` returns `200 OK` with `whisper_ready`.
  - `4.5` Run `pytest` on `mcp-backend/tests/` (`test_e164.py`, `test_FILENAME_REGEX.py`, `test_sidecar.py`, `test_transcription_pipeline.py`).
- **Task 5: Frontend Build, Type-Check & Lint**
  - `5.1` Verify `npx tsc --noEmit` passes with zero errors.
  - `5.2` Verify `npm run build` completes cleanly and outputs `dist/`.
  - `5.3` Verify Vite dev server (`npm run dev` on Port 5173) connects to Port 8000 backend.
  - `5.4` Test all primary UI views (Dashboard, Contacts, Calls/Transcripts, Intelligence Workbench, Graph, System Bots/Sentinel).
- **Task 6: End-to-End Pipeline & Mobile Readiness**
  - `6.1` Drop a test audio file + `.properties` sidecar into `mcp-backend/incoming_calls/` and verify watchdog ingestion → transcription → Gemini brief → Supabase persistence.
  - `6.2` Send a simulated ACR multipart `POST /v1/audio/transcriptions` to Port 9000 and verify E2E processing.
  - `6.3` Verify Tailscale Funnel routing (`https://hp-z2g3-1.tail84647d.ts.net` → Port 9000).
  - `6.4` Run `npx cap sync android` and verify Capacitor mobile build configuration.

---

### 2.3 Kanban Board Cards (`Imports_legitk1ng/scripts/kanban_cards.json`, `horizon_kanban.html` & `TEAM_KANBAN.html`)

#### A. 56 Master Cards from `kanban_cards.json` / `horizon_kanban.html`
- **Column: `DONE` (14 Cards):**
  - `c1` FastAPI Core Server (`main.py` Port 8000)
  - `c2` Ingestion Server (`ingestion_server.py` Port 9000)
  - `c3` Process Supervisor (`horizon_supervisor.py`)
  - `c4` Whisper Transcription Service (`faster-whisper` int8)
  - `c5` ACR Webhook Receiver (`POST /v1/audio/transcriptions`)
  - `c6` Sidecar `.properties` / `.json` Parser
  - `c7` E.164 Phone Normalization Utility (`normalize_e164`)
  - `c8` 14-Pattern Filename Parser (`parse_acr_filename`)
  - `c9` 3-Tier Call Deduplication (Filename, SHA-256, Timestamp±120s)
  - `c10` Watchdog Folder Scanner (`scanner_service.py`)
  - `c11` React 19 + Vite + Tailwind Frontend Scaffold
  - `c12` Supabase Client & Service-Role Integration
  - `c13` Gemini 2.0 Flash Executive Briefing Service (`ai_briefing_service.py`)
  - `c14` AES-256-GCM Field Encryption Module (`core/security/crypto.py`)
- **Column: `IN PROGRESS` / `REVIEW` (18 Cards):**
  - `c15` Pyannote 3.1.1 Speaker Diarization Integration (`diarization_service.py`)
  - `c16` HorizonSentinel Self-Healing Daemon (`core/sentinel.py`)
  - `c17` System Auditor & Diagnostics Endpoint (`core/auditor.py`)
  - `c18` Google People API Bidirectional Sync (`services/google_sync.py`)
  - `c19` OSINT Enrichment Worker (`services/enrichment_service.py`, `osint_service.py`)
  - `c20` Relationship Health Scoring & Decay Engine (`services/nudges_service.py`)
  - `c21` Proactive Nudge Shelf UI (`NudgeShelf.tsx`)
  - `c22` D3.js Force-Directed Relationship Graph (`RelationshipGraph.tsx`)
  - `c23` Intelligence Workbench Manual/ACR Ingest UI (`IntelligenceWorkbench.tsx`)
  - `c24` Floating AI Assistant Chat & RAG (`FloatingChat.tsx`, `routers/chat.py`)
  - `c25` Semantic Search with `text-embedding-004` + `pgvector` (`routers/search.py`)
  - `c26` Capacitor 8 Android Bridge (`capacitor.config.ts`, `android/`)
  - `c27` Tailscale Funnel & Mesh Networking (`hp-z2g3-1`, `surface3`)
  - `c28` Obsidian Vault Markdown Export/Sync (`contact-intelligence-obsidian.md`)
  - `c29` Morning Briefing Generator (`routers/briefing.py`)
  - `c30` Provenance & Data Lineage Lab (`Lab.tsx`, `routers/provenance.py`)
  - `c31` Command Palette (`Ctrl+K` / `Cmd+K` via `CommandPalette.tsx`)
  - `c32` Local-First Dexie.js IndexedDB Cache & Sync Engine (`localDb.ts`, `syncService.ts`)
- **Column: `BACKLOG` / `TO DO` (24 Cards):**
  - `c33` GPU VRAM Serial Execution Lock (`PATCH-06` for Quadro M620 2GB)
  - `c34` Voice Biometrics / Speaker Enrollment (`voice_profiles` matching)
  - `c35` Automated Call Backfill Batch Processor (`routers/transcriptions.py /backfill`)
  - `c36` Supabase RLS Hardening & Policy Migration
  - `c37` API Rate Limiting (`slowapi` on AI & Search routes)
  - `c38` Frontend Retry & Exponential Backoff Circuit Breaker (`apiClient.ts`)
  - `c39` Push Notifications via Firebase Cloud Messaging (`services/fcm_service.py`, `push_tokens`)
  - `c40` Automated Daily Digest Email / Push Delivery
  - `c41` Contact Merge & Deduplication UI Workflow
  - `c42` Interactive Audio Player with Diarized Transcript Word Highlighting
  - `c43` Custom Tagging & Smart Lists / Segments
  - `c44` Calendar Integration (Google Calendar Meeting Prep Briefs)
  - `c45` Gmail / Email Thread Metadata Ingestion
  - `c46` Export Call Dossiers to PDF / Markdown
  - `c47` Multi-User Workspace & Role-Based Access Control
  - `c48` Webhook Dead-Letter Queue (DLQ) Retry Dashboard UI
  - `c49` Automated Pytest & Vitest CI/CD GitHub Actions Pipeline
  - `c50` Playwright End-to-End Test Suite
  - `c51` Windows Service / NSSM / Task Scheduler Daemonization for `horizon_supervisor.py`
  - `c52` Bundle Size Optimization & Code Splitting (`React.lazy` for Graph/Workbench)
  - `c53` Design Token v4.0 Full CSS Variable Migration (`--hzn-*` Ochre palette)
  - `c54` WCAG 2.1 AA Accessibility & Keyboard Navigation Audit
  - `c55` Offline Mutation Conflict Resolution UI
  - `c56` Hardware Telemetry & GPU/CPU Load Widget in System Health View

#### B. War-Room `TEAM_KANBAN.html` (`Desktop_horizon/docs/plans/TEAM_KANBAN.html`)
- Tracks the 4-Agent War-Room Sprint:
  - **Track 1 (Corpus & Pearl Harvest):** Inventory all 9 Horizon directories (`HARVEST_LOG.md`, `SURFACE_PEARL_LEDGER.md`, `PEARL_LEDGER_SKELETON.json`).
  - **Track 2 (Backend & Pipeline Stabilization):** Reconcile `calls.py` vs `transcriptions.py` (`ingestion-reconciliation.md`, `pipeline-notes.md` F-01 to F-16).
  - **Track 3 (Local-First & AI Chat Stabilization):** Implement `2026-04-13-ai-chat-stabilization-design.md` and `2026-05-10-local-first-architecture-plan.md` (Dexie `localDb.ts` + `syncService.ts`).
  - **Track 4 (Workspace Reorganization):** Clean root directory per `REORG_MANIFEST.json` (completed `2026-08-16`, subject to fixing `REORG-01` and `REORG-02`).

---

### 2.4 Automated Engineering Review Action Items (`docs/reviews/archive/*` & `auto-generated/*`)

1. **`IMMEDIATE_ACTION_ITEMS.md` & `CRITICAL_ACTIONS_REQUIRED.md`:**
   - Kill zombie Python processes on Port 9000 (`Stop-Process -Name python -Force`).
   - Add PID file lock (`core/process_lock.py`) so only 1 `ingestion_server.py` instance can bind Port 9000.
   - Downgrade Node.js from v25.8.0 to **v22.17.0 LTS** to eliminate native V8 segfaults (`0xC0000005`).
   - Consolidate `mcp-backend/venv` (2.66 GB) and `mcp-backend/.venv` (0.37 GB) into a single virtual environment (`STORAGE_AUDIT_ADDENDUM.md`).
2. **`AUTOMATED_ENGINEERING_REVIEW_2026-06-22_FINAL.md` & `ENGINEERING_FIXES_APPLIED_*` (6 Rounds):**
   - **Round 1 (`2026-06-21`):** Removed `--reload` in production (`horizon_supervisor.py`), added memory limits (`--max-old-space-size=8192`) in `package.json`, optimized `vite.config.ts` (`reportCompressedSize: false`, `manualChunks`).
   - **Round 2 (`2026-06-22`):** Fixed `GuardianService.ts` memory leak by storing interval IDs in `this.intervals` and adding `dispose()`; added 10s `AbortController` timeout to `apiClient.ts`.
   - **Round 3 (`2026-06-22_08-17`):** Added React `ErrorBoundary` wrapping main views (`App.tsx`), fixed unhandled promise rejections in `Dashboard.tsx` and `FloatingChat.tsx`.
   - **Round 4 (`2026-06-22_15-25`):** Fixed `HorizonSentinel` (`core/sentinel.py`) to call `TranscriptionManager` instead of private router function `_run_transcription`.
   - **Round 5 (`2026-06-23_00-14`):** Added startup encryption key canary verifier (`core/security/verify_key.py`), removed `socket.io-client`, moved `@google/clasp` to `devDependencies`.
   - **Round 6 (`2026-06-23_01-14`):** Audited remaining frontend dependencies and verified `CONSTITUTION_PATCHES.md` alignment.

---

### 2.5 Master Requirements Ledger (`PROJECT_REQS.md` 221 Items + Legacy `master_prompt_legacy.md` REQ-001 to REQ-040)

#### A. `Desktop_horizon/docs/PROJECT_REQS.md` (221 Requirements across 4 Stages)
- **Stage 1: Core Infrastructure, Database & Ingestion Pipeline (REQs 1–60):**
  - Dual-server FastAPI architecture (Port 8000 REST + Port 9000 ACR Ingestion), `horizon_supervisor.py` process management, Supabase 17-table schema + `pgvector`, E.164 normalization, 14 ACR filename formats, `.properties`/`.json` sidecar parsing, 3-tier deduplication, SHA-256 hashing, `incoming_calls/` watchdog scanner, failed call dead-letter archival (`failed_calls/`), and AES-256-GCM transcript encryption.
  - **Status:** ~90% implemented; blocked only by `REORG-01`/`REORG-02`, `CALLS-ENC-01`/`02`, and `SCHEMA-ENC-01`/`SCHEMA-TASKS-01`.
- **Stage 2: AI Intelligence, Transcription, Diarization & OSINT (REQs 61–120):**
  - Faster-Whisper (`base`/`small` int8) transcription, Pyannote 3.1.1 speaker diarization (`SPEAKER_00`/`SPEAKER_01`), Gemini 2.0 Flash executive briefing (`summary`, `sentiment`, `key_topics`, `action_items`, `follow_up_questions`, `relationship_signals`), `text-embedding-004` 768-dim semantic embeddings, `match_call_records` / `match_contacts` RPC search, OSINT enrichment (`enrichment_service.py`), Google People API sync, and HorizonSentinel self-healing loop.
  - **Status:** ~85% implemented; needs `PATCH-06` serial GPU lock (or explicit CPU config), `HUGGINGFACE_TOKEN` validation, and `run_in_executor` wrapping for synchronous Gemini/Whisper calls in `calls.py` & `sentinel.py`.
- **Stage 3: Frontend UI/UX, Local-First Sync & Visualizations (REQs 121–185):**
  - React 19 + TypeScript + Tailwind CSS + Framer Motion UI, Warm Ochre (`#B8722E` / `#E8A656`) v4.0 Design Tokens, Dexie.js local-first IndexedDB cache (`localDb.ts`) + 30s background sync (`syncService.ts`), Dashboard with Executive Briefs, Contact Dossiers, Nudge Shelf, D3.js Relationship Graph, Intelligence Workbench, Floating RAG Chat, Command Palette (`Ctrl+K`), Provenance Lab, and System Bots/Sentinel Monitor.
  - **Status:** ~88% implemented; requires cherry-picking the 4 unmerged `Claud_Rescue` fixes (`NudgeShelf.tsx`, `SentimentSchema`, `TouchpointSchema.contact_id`, `RelationshipGraph.tsx` zoom).
- **Stage 4: Mobile Capacitor Bridge, Tailscale Mesh & Production Hardening (REQs 186–221):**
  - Capacitor 8 Android wrapper (`com.horizon.prm`), `Capacitor.isNativePlatform()` URL switching, FCM push notification registration (`push_tokens`), Tailscale mesh (`100.76.83.52`) + Tailscale Funnel (`https://hp-z2g3-1.tail84647d.ts.net` → Port 9000), RLS policy enforcement, rate limiting, and E2E test verification.
  - **Status:** ~70% implemented; pending RLS hardening, rate limiting, and final `npx cap sync android` APK verification.

#### B. Legacy `REQ-001` to `REQ-040` (`New folder/master_prompt_legacy.md` & `Desktop_horizon/test_results.json`)
- Per `Desktop_horizon/test_results.json` (automated verification suite):
  - **39 of 40 Legacy Requirements (`REQ-001` through `REQ-039`) PASS.**
  - **1 Legacy Requirement (`REQ-040` — Cloud Run Deployment / `cloudbuild.yaml`) is DEPRECATED / SUPERSEDED** by the bare-metal HP Z2G3 Mini + Tailscale Funnel architecture (`CONSTITUTION.md` §3).

---

### 2.6 Surface3 ACR Gateway Pending Tasks (`Imports_Surface3_WP/ACR_Gateway_Session_Log.md`)

If the standalone `C:\ACR-Gateway` node on `surface3` (`100.109.206.101`) is used alongside or as a backup to `hp-z2g3-1`:
1. **Replace Placeholder HuggingFace Token (`BUG-09`):** Update `C:\ACR-Gateway\.env` (`HF_TOKEN=hf_YOUR_HUGGINGFACE_TOKEN_HERE`) with a real token that has accepted terms on `hf.co/pyannote/speaker-diarization-3.1` and `hf.co/pyannote/segmentation-3.0`.
2. **Apply `001_add_acr_transcripts_table.sql` (`BUG-11`):** Run the SQL migration in the Supabase SQL Editor to create the `acr_transcripts` table (or point Surface3's gateway to `call_records`).
3. **Register Windows Scheduled Task (`Start-Gateway.ps1`):** Register `C:\ACR-Gateway\Start-Gateway.ps1` in Windows Task Scheduler (`AtStartup`, Run whether user is logged on or not) so uvicorn + Tailscale Funnel survive reboots.

---

## SECTION 3: Architectural & Operational Pearls

These domain rules, hardware constraints, regex patterns, and troubleshooting fixes were extracted from across the corpus (`CONSTITUTION.md`, `CONSTITUTION_PATCHES.md`, `API_CONTRACT.md`, `DESIGN_TOKENS.md`, `SURFACE_PEARL_LEDGER.md`, `ACR_Gateway_Session_Log.md`, and `pipeline-notes.md`).

---

### 3.1 Three-Zone Architectural Decoupling & Two-Server Port Map

- **Strict Three-Zone Separation (`CONSTITUTION.md` §3):**
  1. **Zone 1 (Frontend Client — React 19 / Vite / Dexie.js / Capacitor 8):** Never holds `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, or `FIELD_ENCRYPTION_MASTER_KEY`. Communicates exclusively with Port 8000 (`main.py`) via `X-Horizon-Key` / `Authorization: Bearer`.
  2. **Zone 2 (MCP Backend — FastAPI Python 3.11+ on HP Z2G3 Mini):** Split into two isolated processes managed by `horizon_supervisor.py`:
     - **Port 8000 (`main.py`):** 16 REST routers (`/api/v1/*`), Tailnet-only (`100.76.83.52:8000` / `localhost:8000`). Never exposed to the public internet.
     - **Port 9000 (`ingestion_server.py`):** ACR Phone webhook receiver (`POST /v1/audio/transcriptions`), watchdog `scanner_service.py`, and `HorizonSentinel` (`core/sentinel.py`). Publicly exposed via **Tailscale Funnel** (`https://hp-z2g3-1.tail84647d.ts.net`).
  3. **Zone 3 (Persistence & External Cloud — Supabase PostgreSQL + `pgvector`, Gemini 2.0 Flash, Google People API):** Accessed from Zone 2 using the Supabase `service_role` key.

### 3.2 Tailnet 6-Device Mesh Topology (`tail84647d.ts.net`)

| Hostname | Tailscale IP | Hardware / OS | Role in Horizon |
| :--- | :--- | :--- | :--- |
| **`hp-z2g3-1`** | `100.76.83.52` | HP Z2 Mini G3 (Intel Xeon/i7, Quadro M620 2GB VRAM, Windows) | **Primary Production Server** (Port 8000 REST API + Port 9000 Ingestion Server + Tailscale Funnel) |
| **`surface3`** | `100.109.206.101` | Microsoft Surface Book 3 (Windows) | Secondary Dev / Standalone ACR Gateway (`C:\ACR-Gateway`) |
| **`eclipse`** | `100.118.252.35` | Windows Workstation | OpenClaw Agent Node / Secondary Dev (`C:\Users\legit\Eclipse`) |
| **`google-pixel-10-pro-xl`** | `100.109.61.98` | Android 16 (Pixel 10 Pro XL) | **Primary ACR Phone Capture Device** & Capacitor Mobile Client |
| **`bbox`** | `100.88.53.15` | Linux Node | Auxiliary Mesh Node |
| **`legitk1ng-pc`** | Local Dev | Windows 11 (`C:\Users\legitk1ng`) | Primary Engineering Workstation |

- **Tailscale Funnel Windows TLS Fix (`BUG-04` Pearl):**
  - On Windows, running `tailscale funnel 9000` directly can cause TLS handshake timeouts (`curl: (35)Recv failure`).
  - **Mandatory 2-Step Command:**
    ```powershell
    tailscale serve --bg 9000
    tailscale funnel --bg 443
    ```

---

### 3.3 ACR Phone Webhook Protocol & Field-Casing Gotchas

- **Endpoint Path:** ACR Phone's "Cloud Backup → OpenAI Whisper / Custom Webhook" posts `multipart/form-data` to `POST /v1/audio/transcriptions` (or `POST /webhook/acr`).
- **Field-Casing Gotcha (`CONSTITUTION.md` §10):**
  - ACR Phone versions vary casing across builds and configurations! Endpoints **MUST** accept both Title-Case and lowercase form fields:
    - Audio file: `file` or `File` (or `audio`)
    - Secret: `Secret` or `secret` (or HTTP headers `X-ACR-Secret`, `X-Webhook-Secret`, `Authorization: Bearer <secret>`)
    - Phone number: `Number` or `number` or `phone_number`
    - Call direction: `Source` or `source` (`Incoming` / `Outgoing` / `1` / `2`)
    - Timestamp: `Date` or `date` (Unix epoch ms, Unix epoch sec, or ISO-8601 string)
    - Duration: `Duration` or `duration` (seconds)
    - Contact name / note: `Note` or `note` or `contact_name`
- **ACR Connection Test Button (`BUG-10` Pearl):**
  - When the user taps "Test Connection" in ACR Phone settings, ACR sends an empty `POST /` or `GET /` to the root URL. The ingestion server must return `200 OK` on both `GET /` and `POST /` so ACR's settings UI reports a green check.

---

### 3.4 All 14 ACR Filename Patterns & Canonical Naming (`parse_acr_filename`)

Implemented in `mcp-backend/routers/transcriptions.py` (`_ACR_PATTERNS`, lines 60–245):
1. **Canonical Horizon Format:** `call_[ContactName]_+1XXXXXXXXXX_YYYYMMDD_HHMMSS.<ext>`
2. **Pattern A (ACR Default Dated):** `ACR_YYYYMMDD-HHMMSS_+1XXXXXXXXXX.<ext>`
3. **Pattern B (ACR Direction Prefix):** `Incoming_YYYYMMDD_HHMMSS_+1XXXXXXXXXX.<ext>` / `Outgoing_...`
4. **Pattern C (Cube ACR Style):** `phone_YYYYMMDD-HHMMSS_ContactName_+1XXXXXXXXXX.<ext>`
5. **Pattern D (Bracketed Contact):** `[Contact Name]_+1XXXXXXXXXX_YYYY-MM-DD_HH-MM-SS.<ext>`
6. **Pattern E (Epoch Milliseconds):** `1718928000000_+1XXXXXXXXXX.<ext>` (13-digit ms epoch)
7. **Pattern F (Epoch Seconds):** `1718928000_+1XXXXXXXXXX.<ext>` (10-digit sec epoch)
8. **Pattern G (Number First, Compact Date):** `+1XXXXXXXXXX_YYYYMMDDHHMMSS.<ext>`
9. **Pattern H (Contact First, Compact Date):** `ContactName_YYYYMMDD_HHMMSS.<ext>`
10. **Pattern I (Dash-Separated ISO):** `YYYY-MM-DD_HH-MM-SS_+1XXXXXXXXXX_Contact.<ext>`
11. **Pattern J (Android CallRecorder Standard):** `Call@12-30-45_2026-06-21_+1XXXXXXXXXX.<ext>`
12. **Pattern K (Parenthesized Number):** `Contact Name (+1XXXXXXXXXX) YYYY-MM-DD HH.MM.SS.<ext>`
13. **Pattern L (Double-Underscore Delimited):** `IN__+1XXXXXXXXXX__20260621T123045.<ext>`
14. **Pattern M/N (Fallback Heuristic Extractor):** Regex scan for any E.164/10-digit phone substring + 8-digit date (`20\d{6}`) + 6-digit time (`\d{6}`) anywhere in the stem; falls back to file `mtime` if no timestamp exists.

---

### 3.5 Sidecar Priority Hierarchy & 3-Tier Deduplication

- **Metadata Resolution Priority (`transcriptions.py`):**
  1. **Tier 1 (Highest):** HTTP Multipart Form Fields (`Number`, `Date`, `Duration`, `Source`, `Note`)
  2. **Tier 2:** Companion Sidecar File (`.properties` Java key=value format or `.json` file with the same stem in `incoming_calls/`)
  3. **Tier 3:** Filename Regex Extraction (`parse_acr_filename` across the 14 patterns)
  4. **Tier 4 (Lowest):** Filesystem `stat().st_mtime` and audio container duration probe
- **3-Tier Deduplication before Whisper Inference (`_check_duplicate` in `transcriptions.py:346-408`):**
  1. Exact `source_filename` match in `call_records`.
  2. Exact SHA-256 `audio_hash` match in `call_records`.
  3. Fuzzy match: same `phone_number` (normalized to E.164) + `call_timestamp` within **±120 seconds**.

---

### 3.6 E.164 Phone Normalization Pearl (`normalize_e164`)

- Strip all non-digit characters except leading `+`.
- If 10 digits (`^\d{10}$`) → prefix `+1` (US/Canada default: `+1XXXXXXXXXX`).
- If 11 digits starting with `1` (`^1\d{10}$`) → prefix `+` (`+1XXXXXXXXXX`).
- If already `+\d{7,15}` → keep as-is.
- Reject/return `None` for short codes (<7 digits) or emergency numbers (`911`), or mark as `"Unknown"` so contact matching does not falsely merge unrelated unknown callers.

---

### 3.7 Hardware & Windows Audio/ML Pearls

1. **HP Z2G3 Mini GPU Constraint (`PATCH-06` — Quadro M620 2GB VRAM):**
   - The Quadro M620 has only **2,048 MB VRAM**. Loading `faster-whisper` (`small`/`base`) and `pyannote/speaker-diarization-3.1` simultaneously on CUDA triggers `RuntimeError: CUDA out of memory`.
   - **Rule:** Never hold both models in VRAM at the same time. Either run sequentially with explicit `del model; gc.collect(); torch.cuda.empty_cache()` between Stage 1 (Whisper) and Stage 2 (Pyannote), or run `faster-whisper` on CPU (`int8`) and reserve GPU for Pyannote.
2. **Windows Pyannote 4.0 Crash (`BUG-06` Pearl):**
   - `pyannote.audio >= 4.0` depends on `torchcodec`, which fails with native DLL load errors on Windows (`Could not load libtorchcodec`).
   - **Rule:** Strictly pin `pyannote.audio==3.1.1` and `huggingface_hub<1.0` on Windows.
3. **Windows Audio Container Decoding (`BUG-07` Pearl):**
   - ACR Phone outputs `.m4a` (AAC), `.mp4`, `.ogg` (Opus), `.flac`, or `.mp3`. `torchaudio` with `soundfile` backend on Windows cannot decode `.m4a`/`.mp4` natively.
   - **Rule:** Decode via **PyAV (`import av`)** or `ffmpeg` into a 16kHz mono `float32` numpy array / temporary `.wav` before passing to Whisper and Pyannote (`preload_audio_16k_mono`).
4. **Node.js Windows Vite Build Segfault (`NODE-CRASH-01` Pearl):**
   - Node.js v25.x (odd-numbered non-LTS) crashes with Windows Access Violation (`0xC0000005`) during Rollup AST bundling on large React/Lucide trees.
   - **Rule:** Use **Node.js v22.17.0 LTS**, set `NODE_OPTIONS=--max-old-space-size=8192`, and keep `reportCompressedSize: false` and `sourcemap: mode !== 'production'` in `vite.config.ts`.
5. **Design System v4.0 Ruling (`DESIGN_TOKENS.md`):**
   - Constitution v3.0 accidentally wrote `#0066FF` ("Horizon Blue"). `DESIGN_TOKENS.md` v4.0 is the authoritative override: Horizon's primary brand identity is **Warm Ochre (`#B8722E` light / `#E8A656` dark)** on Warm Stone (`#F6F4F0`) and Carbon Black (`#0F0E0C`).
6. **Google OAuth Refresh Token Gotcha (`google_sync.py`):**
   - Google only returns a `refresh_token` on the **first** authorization consent when `access_type='offline'` and `prompt='consent'` are set. If `refresh_token` is missing on subsequent logins, never overwrite an existing stored `refresh_token` in Supabase with `null`.
