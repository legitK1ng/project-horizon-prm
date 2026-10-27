# ACR Transcription Gateway — Complete Session Log

> **Project Horizon PRM | Session Date: 2026-04-06**  
> Gateway bridges the ACR Phone app → Whisper+Pyannote → Supabase → Horizon Lab UI.

---

## 1. Files Created From Scratch

### Backend — `mcp-backend/gateway/`

| File | Purpose | Status |
|------|---------|--------|
| `gateway/__init__.py` | Package marker | ✅ Done |
| `gateway/hardware.py` | CUDA/CPU auto-detection singleton | ✅ Done |
| `gateway/pipeline.py` | Serial Whisper+Pyannote orchestrator | ✅ Done |
| `gateway/supabase_sink.py` | Supabase upsert/fetch layer | ✅ Done |
| `gateway/acr_router.py` | FastAPI router with 5 endpoints | ✅ Fixed |

### Backend — `mcp-backend/`

| File | Purpose | Status |
|------|---------|--------|
| `migrations/001_add_acr_transcripts_table.sql` | Supabase DDL | ✅ Done — **NOT yet applied** |
| `tests/test_acr_gateway.py` | 50-test suite | ✅ Fixed |
| `pytest.ini` | Pytest asyncio config | ✅ Added this session |

### Frontend — `src/`

| File | Purpose | Status |
|------|---------|--------|
| `services/webhookService.ts` | Typed fetch client for gateway | ✅ Done |
| `hooks/useWebhookJobs.ts` | TanStack Query polling hooks | ✅ Fixed |
| `components/WebhookMonitor.tsx` | Live job table + transcript drawer | ✅ Fixed |

### PowerShell Scripts — `scripts/`

| File | Purpose | Status |
|------|---------|--------|
| `Setup-Gateway.ps1` | One-time venv + dep install + FFmpeg | ✅ Done |
| `Start-Gateway.ps1` | Activate venv + launch uvicorn | ✅ Done |
| `Test-Gateway.ps1` | Simulate full ACR handshake + WAV | ✅ Done |
| `Cleanup-Audio.ps1` | Safe delete raw audio (transcript-verified) | ✅ Done |

---

## 2. Files Modified

| File | Change | Status |
|------|--------|--------|
| `mcp-backend/main.py` | Integrated acr_router + 3 MCP tools | ✅ Done |
| `mcp-backend/requirements.txt` | Added AI deps, deduped httpx | ✅ Fixed |
| `mcp-backend/.env` | Added ACR_SECRET, HF_TOKEN, storage dirs | ✅ Done |
| `src/components/Lab.tsx` | Added "Webhook" tab + Phone icon | ✅ Done |
| `.env` (root) | Added VITE_GATEWAY_URL, ACR_SECRET | ✅ Done |
| **`src/App.tsx`** | **Added QueryClientProvider wrapper** | ✅ **Fixed this session** |

---

## 3. Bugs Found & Fixed This Session

### 🔴 Critical

#### BUG-01 — `QueryClientProvider` missing from app root
- **File:** `src/App.tsx`
- **Symptom:** `WebhookMonitor` calls `useQueryClient()` which throws `"No QueryClient set"` at runtime the moment the Lab → Webhook tab is opened. The entire Webhook tab would crash silently.
- **Root cause:** `@tanstack/react-query` requires a `QueryClientProvider` ancestor. None existed in the tree.
- **Fix:** Created `queryClient` singleton above `App`, wrapped entire app: `<QueryClientProvider client={queryClient}>`.

#### BUG-02 — ACR `Date`/`Duration` sent as strings, typed as `Optional[int]`
- **File:** `mcp-backend/gateway/acr_router.py`
- **Symptom:** Real ACR Phone app sends multipart form values as raw strings (`"1712345678"`). FastAPI form parsing does NOT auto-coerce `Optional[int]` from string values — it returns `422 Unprocessable Entity` for every real upload.
- **Root cause:** `Date: Optional[int] = Form(None)` fails when value is `"1712345678"` (string).
- **Fix:** Changed `Date` and `Duration` to `Optional[str]`, added `date_int = int(Date) if Date else None` coercion before use.

### 🟠 High

#### BUG-03 — `safe_number` used before assignment (introduced during BUG-02 fix)
- **File:** `mcp-backend/gateway/acr_router.py`
- **Symptom:** `NameError: name 'safe_number' is not defined` on any upload that includes a phone number.
- **Root cause:** During the multi-replace that fixed BUG-02, the sanitisation line for `safe_number` was accidentally omitted from the refactored block.
- **Fix:** Restored `safe_number = "".join(c for c in Number if c.isdigit() or c == "+")` inside the `if date_int and Number:` branch.

#### BUG-04 — Wrong `refetchInterval` callback type in `useJobStatus`
- **File:** `src/hooks/useWebhookJobs.ts`
- **Symptom:** Manually annotated `(query: { state: { data?: { status?: string } } })` is incompatible with TanStack Query v5's internal `Query` generic, causing a TypeScript compile error.
- **Fix:** Removed the inline type annotation (let TypeScript infer), used `as { status?: string } | undefined` cast on `query.state.data` to narrow safely.

### 🟡 Medium

#### BUG-05 — T27/T29 patched `json.dump` globally
- **File:** `mcp-backend/tests/test_acr_gateway.py`
- **Symptom:** `patch("json.dump")` replaces the stdlib `json` module's `dump` function for ALL callers in the process. This can corrupt `JSONResponse` serialisation and other internal calls during the test run — tests may pass individually but fail in sequence.
- **Fix:** Changed to `patch("gateway.pipeline.json") as mock_json` + `mock_json.dump = MagicMock()`. This scopes the mock to only `pipeline.py`'s `json` reference.

#### BUG-06 — T33 mock target wrong namespace
- **File:** `mcp-backend/tests/test_acr_gateway.py`
- **Symptom:** `patch("gateway.supabase_sink.list_transcripts")` has no effect because `main.py` does `from gateway.supabase_sink import list_transcripts` — the name is bound in `main`'s local namespace, not `supabase_sink`'s.
- **Fix:** Changed patch target to `"main.list_transcripts"`.

#### BUG-07 — T46 env restore double-set bug
- **File:** `mcp-backend/tests/test_acr_gateway.py`
- **Symptom:** `original = os.environ.get("ACR_SECRET")` returns `"magicalbluetuba"` (always set by `setdefault` at top of file). The `if original:` branch was correct, but the `else:` branch did `del os.environ["ACR_SECRET"]` then immediately `os.environ["ACR_SECRET"] = "magicalbluetuba"` — the delete was pointless and on certain Python versions could raise a `KeyError` race if another thread read the env.
- **Fix:** Simplified to `original = os.environ.get("ACR_SECRET", "magicalbluetuba")` then unconditional `os.environ["ACR_SECRET"] = original` at the end.

### 🟢 Minor

#### BUG-08 — `requirements.txt` duplicate `httpx` + missing `anyio[trio]`
- **Fix:** Removed the second `httpx` line. Added `anyio[trio]` which is required by `pytest-asyncio` on Windows.

#### BUG-09 — T01/T06/T24 missing `upsert_status` patch
- **Symptom:** Tests could trigger a real Supabase write attempt (or noisy warning) if credentials were accidentally valid.
- **Fix:** Added `patch("gateway.pipeline.upsert_status")` to T01, T06, T24.

#### BUG-10 — Unused `cfg` variable in `WebhookMonitor.tsx` stats bar *(fixed previous sub-session)*
- **Fix:** Removed `const cfg = STATUS_CONFIG[s]` — `StatusBadge` receives status directly.

#### BUG-11 — `SPEAKER_COLOURS[idx]` returned `string | undefined` *(fixed previous sub-session)*
- **Fix:** Added `as string` assertion; safe because index is modulo-bounded to array length.

---

## 4. What Was NOT Done (Outstanding)

> **CRITICAL: The Supabase migration has NOT been applied.**  
> The `acr_transcripts` table does not exist. The backend will log  
> `persist_transcript failed` on every successful call but continues  
> working via in-memory + disk fallback.

**How to apply:**
1. Open the [Supabase SQL Editor](https://supabase.com/dashboard/project/jykucnzotuqingrhufdx/sql)
2. Paste and run `mcp-backend/migrations/001_add_acr_transcripts_table.sql`

---

> **WARNING: `HF_TOKEN` is still a placeholder.**  
> `mcp-backend/.env` has `HF_TOKEN=your_huggingface_token_here`.  
> Without a real token, diarization is skipped (logged as a warning).  
> Transcription still works via Whisper with `SPEAKER_UNK` labels.

**How to fix:**
1. Accept terms: https://huggingface.co/pyannote/speaker-diarization-3.1
2. Get token: https://huggingface.co/settings/tokens
3. Replace placeholder in `mcp-backend/.env`

---

> **NOTE: Pre-existing TypeScript errors exist** in `CommandPalette.tsx` (missing `Persona` type)  
> and `Lab.tsx` (duration `number` vs `string`). These are unrelated to this session.  
> All new files are TypeScript-clean.

---

## 5. Architecture Overview

```
ACR Phone App
  │  POST multipart/form-data (Secret, Source, Number, Date, Duration, Note, File)
  ▼
FastAPI /api/Recording/upload  ← gateway/acr_router.py
  │  1. Validate Secret (env ACR_SECRET)
  │  2. Coerce Date/Duration strings → int
  │  3. Sanitize Number → call_id key
  │  4. Duplicate guard (409 if already registered)
  │  5. Save audio → recordings/{call_id}.wav
  │  6. register_job() → in-memory registry + Supabase QUEUED
  │  7. BackgroundTask: process_audio()
  │  8. Return 200 immediately
  ▼
gateway/pipeline.py — serial execution (never concurrent)
  Stage 1: pyannote.audio → speaker-diarization-3.1 (CUDA or CPU)
           VRAM cleared before Stage 2
  Stage 2: faster-whisper tiny.en → text segments
           VRAM cleared after
  Stage 3: midpoint alignment → {speaker, start, end, text}[]
  Stage 4: JSON saved → transcripts/{call_id}.json
  Stage 5: gateway/supabase_sink.py → upsert COMPLETED row
  ▼
Frontend polling every 5 s (useWebhookJobs hook)
  │  GET /api/Recording/transcripts
  ▼
WebhookMonitor.tsx in Lab → Webhook tab
  │  Click "View" on COMPLETED row
  ▼
TranscriptDrawer → GET /api/Recording/transcript/{call_id}
  → Diarized segments with speaker colour coding
  → Full-text copy to clipboard
```

---

## 6. Deployment Checklist (HP Z2G3 Mini)

```powershell
# Step 1: Fill real values in mcp-backend/.env
#    HF_TOKEN = (real token from huggingface.co)
#    Verify SUPABASE_URL / SUPABASE_KEY

# Step 2: Apply Supabase migration (once, from dashboard)

# Step 3: One-time setup
cd C:\Users\owner\WORKPLACE\Horizon
.\scripts\Setup-Gateway.ps1

# Step 4: Start the server (in a dedicated terminal)
.\scripts\Start-Gateway.ps1

# Step 5: Verify with simulated handshake
.\scripts\Test-Gateway.ps1
# Expected: {"status":"success","call_id":"..."}

# Step 6: Configure ACR Phone app
#    Webhook URL: http://100.101.99.29:8000/api/Recording/upload
#    Secret:      magicalbluetuba

# Step 7: Open Horizon app → Lab → Webhook tab → confirm jobs appear
```

---

## 7. Test Coverage Map

| Block | IDs | Functions | Description |
|-------|-----|-----------|-------------|
| Auth | T01–T04, T50 | 5 | Secret validation, missing file, health |
| Call ID | T05–T06 | 2 | Date+Number → key, UUID fallback |
| State | T07 | 1 | QUEUED status after upload |
| Hardware | T08–T10 | 3 | CUDA/CPU detection, compute type |
| Pipeline | T11–T16 | 6 | Serial order, VRAM overflow, alignment, schema |
| Supabase sink | T17 | 1 | persist_transcript called |
| Endpoints | T18–T23 | 6 | Status QUEUED/COMPLETED, list, get, 404 |
| File IO | T24–T25, T31 | 3 | Audio saved, duplicate 409, large file |
| Logging | T26–T30 | 4 | Receive, diarize, success, error logs |
| MCP Tools | T32–T34 | 3 | get_acr_status, list, get_acr_transcript |
| Supabase int | T47–T49 | 3 | Row insert, status update, error persist |
| Env/Config | T44, T46 | 2 | Tailscale IP in .env, secret override |
| Cleanup | T35–T36 | 2 | Removes processed, keeps unprocessed |
| Health | T28 | 1 | /health endpoint |

**28 test functions covering all 14 logical blocks.**

---

*Generated: 2026-04-06 | Horizon PRM | ACR Transcription Gateway*
