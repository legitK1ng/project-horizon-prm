# HORIZON PIPELINE NOTES
**Last Updated:** 2026-05-27  
## Supplementary Technical Record — ACR Phone → Whisper → Supabase Pipeline

> **Purpose:** This document supplements the `CONSTITUTION.md` with ground-truth
> corrections, field mappings, audit findings, and the complete working pipeline
> narrative as of the May 2026 systematic repair pass. Where this document
> contradicts the CONSTITUTION, **this document is correct.**

---

## 1. The Story: End-to-End in Plain English

When Brandon finishes a phone call, here is exactly what happens:

1. **ACR Phone** (NLLAPPS Android app) finishes recording the call as an `.m4a` audio file.
2. ACR Phone POSTs that file, along with call metadata, to the Horizon Ingestion Server running on **port 9000** via **Tailscale Funnel** (`https://hp-z2g3-mini-workstation.tailb79f25.ts.net`).
3. The Ingestion Server (`ingestion_server.py`) receives the request through **InspectorMiddleware** first (capturing the raw request/response for live debugging), then through CORS, then into the `transcriptions.py` router.
4. The router:
   - **Validates** the Bearer token (`Authorization: Bearer <HORIZON_API_KEY>`)
   - **Optionally validates** the ACR `Secret` form field against `ACR_WEBHOOK_SECRET` (only if env is set)
   - **Parses the filename** using `acr_parser_reference.py` to extract structured metadata (date, time, direction, phone, contact name) — enriching any empty form fields
   - **Inserts a `pending` stub** into `call_records` immediately — so HorizonSentinel can detect crashes
   - **Converts the audio** to 16 kHz mono PCM WAV via ffmpeg (`process_audio_ingest`)
   - **Transcribes** the WAV using Faster-Whisper (`tiny.en` by default, configurable via `WHISPER_MODEL_SIZE`)
   - **Generates an executive brief** via Gemini (`generate_call_brief`) if the transcript is > 50 chars
   - **Returns the response** to ACR Phone immediately — JSON with a `"text"` field containing the formatted brief + raw transcript. ACR Phone stores this as the call note on the device.
   - **In the background**, after the response is sent: updates the stub from `processing` → `completed`, encrypts and stores the full transcript, writes action items to the `tasks` table, and broadcasts a Supabase Realtime event so the React Dashboard updates without a page reload.

5. **HorizonSentinel** runs every 5 minutes on the ingestion server. If it finds any `call_records` stuck in `pending` or `processing` for more than 30 minutes, it re-queues them for transcription.

6. The **React Dashboard** (Zone 3) listens on the Supabase Realtime `transcription.completed` event and updates the Call Log component and Relationship Health Score in real time.

---

## 2. Two-Server Architecture — The Rule and Why It Exists

```
Port 8000  — main.py        — Dashboard API, CRUD, contacts, nudges, AI
Port 9000  — ingestion_server.py — ACR Phone webhook, Whisper, Sentinel
```

**Port 9000 is the ONLY externally exposed port** via Tailscale Funnel.
Port 8000 is LAN-only (Capacitor native app calls it on `http://localhost:8000`).

The ACR webhook endpoint (`POST /v1/audio/transcriptions`) lives **exclusively on port 9000**. It must never be registered on port 8000, because:
- Port 8000 does not have `InspectorMiddleware` (live request capture breaks)
- Port 8000 does not run `HorizonSentinel` (self-healing breaks)
- Port 8000 does not have Tailscale Funnel isolation (security boundary breaks)
- ACR Phone is configured to target the Tailscale FQDN, which resolves to port 9000 only

**Finding F-05** from the audit: the transcription router was incorrectly registered on port 8000 in `main.py`. This has been removed.

---

## 3. Correct Startup Command

### Ingestion Server (Port 9000 — the ACR receiver):
```bash
cd mcp-backend
uvicorn ingestion_server:app --host 0.0.0.0 --port 9000 --reload
```

### Dashboard API (Port 8000 — the CRUD backend):
```bash
cd mcp-backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Both servers must be running for full functionality. They are independent processes.

---

## 4. ACR Phone Field Mapping (Ground Truth)

ACR Phone (NLLAPPS) sends a `multipart/form-data` POST with these exact field names:

| ACR Field Name | Type    | Example Value          | Horizon Param     | Notes                                              |
|---------------|---------|------------------------|-------------------|----------------------------------------------------|
| `Secret`      | string  | `"my_webhook_secret"`  | `secret`          | Secondary auth. Validated only if `ACR_WEBHOOK_SECRET` env is set. |
| `Source`      | string  | `"Outgoing"`           | `source`          | Normalized to `"outgoing"` / `"incoming"` / `""`. |
| `Number`      | string  | `"+15551234567"`       | `phone_number`    | Caller's phone number.                             |
| `Date`        | string  | `"1716854400"`         | `call_timestamp`  | Unix timestamp (seconds). Converted to ISO 8601.  |
| `Duration`    | string  | `"125"`                | `duration`        | Call length in seconds.                            |
| `file`        | blob    | (audio bytes)          | `file`            | `.m4a` or `.mp4`. Converted to WAV by ffmpeg.     |
| `model`       | string  | `"whisper-1"`          | `model`           | Accepted: `whisper-1`, `whisper-horizon`, etc.    |

**Direction normalization** (`_normalize_direction()`):
- `"Outgoing"`, `"out"`, `"1"`, `"dialed"`, `"calling"` → `"outgoing"`
- `"Incoming"`, `"in"`, `"0"`, `"received"`, `"receiving"` → `"incoming"`
- Anything else → `""` (unknown; diarization skips speaker assignment)

**Speaker assignment from direction:**
- `"outgoing"` → Speaker 0 = Brandon (the user who placed the call)
- `"incoming"` → Speaker 0 = the external contact (Brandon is Speaker 1)

---

## 5. Environment Variables (Corrected Reference)

| Variable                    | Used By                    | Notes                                                                 |
|-----------------------------|----------------------------|-----------------------------------------------------------------------|
| `HORIZON_API_KEY`           | `core/api_key_auth.py`     | Primary Bearer token auth. Required. ACR Phone sends in `Authorization` header. |
| `ACR_WEBHOOK_SECRET`        | `routers/transcriptions.py`| Secondary auth via form field. Optional — auth skipped if not set.   |
| `SUPABASE_URL`              | `db/supabase_client.py`    | Supabase project URL.                                                 |
| `SUPABASE_SERVICE_KEY`      | `db/supabase_client.py`    | Service role key (bypasses RLS). Keep secret.                        |
| `GOOGLE_API_KEY`            | `services/ai_briefing_service.py` | **Gemini API key.** The CONSTITUTION incorrectly calls this `GEMINI_API_KEY`. The actual code and `.env` use `GOOGLE_API_KEY`. |
| `FIELD_ENCRYPTION_MASTER_KEY` | `core/security/crypto.py` | AES-256-GCM key for transcript encryption (REQ-037). **If lost, all encrypted transcripts are permanently unrecoverable.** Store in password manager separate from codebase. |
| `WHISPER_MODEL_SIZE`        | `services/transcription_service.py` | Default: `"tiny"`. Set to `"base"` or `"medium"` for better accuracy at cost of speed. |
| `INGEST_PORT`               | `ingestion_server.py`      | Default: `9000`.                                                      |
| `PORT`                      | `main.py`                  | Default: `8000`.                                                      |
| `RATE_LIMIT_RPM`            | `main.py`                  | Requests per minute per IP on port 8000. Default: `120`.             |

> **CONSTITUTION ERROR (F-04):** Section 4 lists `GEMINI_API_KEY` as the required env var.
> The actual variable name throughout the codebase is `GOOGLE_API_KEY`. Your `.env` file
> must use `GOOGLE_API_KEY=...` or Gemini briefing will silently fail.

---

## 6. Pipeline State Machine

```
ACR Phone POSTs audio
        │
        ▼
  [stub inserted]
  status = "pending"   ← Sentinel monitors: stuck > 30 min → retry
        │
        ▼
  status = "processing" ← Sentinel monitors: stuck > 30 min → retry
        │
   (ffmpeg + Whisper + Gemini)
        │
        ├──────────────────────────────────────────────────────┐
        │  ACR Response sent immediately                       │
        │  { "text": "━━━ HORIZON BRIEF ━━━\n..." }           │
        │  ACR Phone stores this as the call note on device   │
        │                                                      │
        ▼  (background task, after response is sent)          │
  status = "completed"   ───── or ───── status = "error"       │
        │                                                      │
        ├── transcript encrypted (AES-256-GCM)                 │
        ├── tasks rows written for each action item            │
        └── Supabase Realtime broadcast → Dashboard updates    │
```

**Why the split?** ACR Phone waits synchronously for the HTTP response. If we blocked until the DB write finished, timeouts would occur on long audio files. The response is sent as soon as transcription completes; the persist runs in a FastAPI `BackgroundTask`.

**Sentinel behavior:**
- Runs every 300 seconds on the ingestion server
- Queries `call_records` for rows where `status IN ('pending','processing')` and `updated_at < now() - interval '30 minutes'`
- Attempts re-transcription using the same `_run_transcription()` function exported from `transcriptions.py`
- Increments retry counter; after max retries, marks as `error`

---

## 7. Whisper Transcription Parameters (Canonical)

All transcription paths — ACR webhook and batch ingest (`calls.py`) — now use these identical parameters to produce equivalent quality output:

```python
model.transcribe(
    wav_path,
    beam_size=5,
    language="en",                  # Or detected language
    vad_filter=True,
    vad_parameters=dict(
        min_silence_duration_ms=500,
        speech_pad_ms=200,
    ),
    condition_on_previous_text=False,
    no_speech_threshold=0.6,
    compression_ratio_threshold=2.4,
)
# Post-filter: drop segments with no_speech_prob >= 0.8
segments = [s for s in segments if getattr(s, "no_speech_prob", 0.0) < 0.8]
```

**Why `condition_on_previous_text=False`?** Prevents the model from confabulating text based on prior segments when there's silence — a common hallucination source with `tiny` models.

**Why `no_speech_threshold=0.6` + post-filter at `0.8`?** Double-layer silence rejection. VAD catches most silence; the probability filter catches anything VAD missed.

**Model singleton:** `TranscriptionManager` uses the Singleton pattern. The model is loaded into RAM once at startup and reused for every call. This prevents the ~3 second load penalty per request.

---

## 8. ACR Filename Parser

ACR Phone creates audio files with a canonical filename encoding all call metadata. The parser (`services/acr_parser_reference.py`) decodes this to enrich missing form fields.

**ACR Canonical Format:**
```
YYYY-MM-DD_HHMMSS_[DIR]_[PHONE]_[ContactName].[ext]
```

**Examples:**
```
2026-05-27_143022_OUT_+15551234567_Daniel-Jeske.m4a
2026-05-27_143022_IN_+19999999999_Unknown.m4a
```

The parser extracts: `datetime_str`, `direction` (`OUT`/`IN`), `phone_e164`, `contact_name`, `canonical_name`, `pattern`.

If a form field arrives empty from ACR Phone (e.g., `contact_name="Unknown"`), the router enriches it from the filename parse. Filename parse is always attempted; failure is non-critical and logged.

---

## 9. Auth Architecture

```
ACR Phone HTTP Request
    │
    ├── Header: Authorization: Bearer <HORIZON_API_KEY>   ← PRIMARY (required)
    │   Validated by: core/api_key_auth.py → verify_api_key()
    │   Fail → 401 Unauthorized
    │
    └── Form field: Secret=<ACR_WEBHOOK_SECRET>           ← SECONDARY (optional)
        Validated by: transcriptions.py inline
        Only checked IF:
          (a) ACR_WEBHOOK_SECRET is set in .env, AND
          (b) ACR Phone actually sends the Secret field
        Fail → 401 Unauthorized
```

**Finding F-11:** `core/auth.py` originally had a fail-open path — if neither `HORIZON_API_KEY` nor `ACR_WEBHOOK_SECRET` was set, it logged a warning but allowed the request through. This is now fail-closed: a misconfigured server returns 503, refusing all requests until properly configured.

---

## 10. DB Schema Notes

### `call_records` table (key columns)
| Column                  | Type        | Source                                  |
|-------------------------|-------------|-----------------------------------------|
| `id`                    | uuid        | Auto-generated                          |
| `status`                | text        | `pending` / `processing` / `completed` / `error` |
| `contact_name`          | text        | Form field or filename parse            |
| `phone_number`          | text        | Form field or filename parse            |
| `direction`             | text        | Normalized from `Source` form field     |
| `channel`               | text        | Always `"phone"` for ACR ingestion      |
| `duration`              | text        | From `Duration` form field              |
| `timestamp`             | timestamptz | From `Date` field or server time        |
| `raw_transcript`        | text        | Full Whisper output                     |
| `transcript`            | text        | Same as `raw_transcript` (dual-write)   |
| `transcript_encrypted`  | text        | AES-256-GCM ciphertext (base64)         |
| `transcript_iv`         | text        | GCM nonce (base64)                      |
| `executive_brief`       | jsonb       | Full Gemini brief object                |
| `sentiment`             | text        | From brief (`"Positive"`, `"Neutral"`, etc.) |
| `tags`                  | text[]      | From brief                              |
| `contact_id`            | uuid        | FK → `contacts.id` (resolved by phone/name) |
| `acr_pattern`           | text        | Filename parse pattern identifier       |
| `acr_phone_e164`        | text        | Normalized E.164 phone                  |
| `canonical_name`        | text        | ACR canonical filename                  |

### `tasks` table — open schema question
The pipeline inserts action items from the Gemini brief as task rows using:
```python
{
    "description": item,
    "status": "pending",
    "contact_id": contact_id,
    "related_call_id": record_id,   # ← verify this column name exists
    "source": "ai_brief",
}
```
> **Note:** The CONSTITUTION (Section 9) refers to `related_touchpoint_id`. Verify the actual
> column name in Supabase. If the insert fails silently, check `[WARN] Task insert failed`
> in the logs. The insert failure is non-critical — call processing continues.

---

## 11. Gemini Brief Object Structure

`generate_call_brief()` in `services/ai_briefing_service.py` calls Gemini and returns:

```json
{
  "title":                    "string — short call title",
  "summary":                  "string — 1-sentence executive brief",
  "sentiment":                "Positive | Neutral | Negative | Mixed",
  "actionItems":              ["string", ...],   // Gemini returns camelCase
  "open_commitments":         [{"commitment": "string", "owner": "Brandon|Contact"}],
  "tags":                     ["string", ...],
  "recommended_followup_date": "YYYY-MM-DD or null",
  "draft_followup_message":   "string or null"
}
```

**Finding F-07:** The CONSTITUTION and internal code used `action_items` (snake_case), but Gemini's prompt instructs it to return `actionItems` (camelCase). The pipeline now reads both: `brief.get("action_items") or brief.get("actionItems", [])`. Do not change the key name in either place — just read both. If you ever want to standardize, change the Gemini prompt to return `action_items` and update the read accordingly.

---

## 12. The 16 Audit Findings and Their Resolutions

| ID   | Finding                                             | File(s) Changed             | Resolution                                                                                      |
|------|-----------------------------------------------------|-----------------------------|-------------------------------------------------------------------------------------------------|
| F-01 | ACR `Secret` form field not validated               | `transcriptions.py`         | Added optional secondary auth: validates `secret` field against `ACR_WEBHOOK_SECRET` if env set. |
| F-02 | `Source` field not mapped to `direction`            | `transcriptions.py`         | Added `_normalize_direction()` helper; maps ACR's `"Outgoing"/"Incoming"` to canonical values.  |
| F-03 | Ghost route `/v1/audio/audio/transcriptions`        | `transcriptions.py`         | Removed duplicate `@router.post("/audio/transcriptions")` decorator. Only `@router.post("/transcriptions")` remains. |
| F-04 | `GEMINI_API_KEY` in CONSTITUTION ≠ `GOOGLE_API_KEY` in code | CONSTITUTION.md (doc only) | Code is correct. CONSTITUTION section updated. Use `GOOGLE_API_KEY` in `.env`.               |
| F-05 | Transcription router registered on port 8000        | `main.py`                   | Removed `include_router(transcriptions.router)` from `main.py`. Endpoint lives only on port 9000. |
| F-06 | Test script targeted wrong port / field names       | `scripts/test_acr_upload.py`| Rewrote to target port 9000, use exact ACR field names (`Secret`, `Source`, `Number`, `Date`, `Duration`). |
| F-07 | `actionItems` (Gemini) ≠ `action_items` (code)      | `transcriptions.py`         | Pipeline reads both keys; uses whichever is present. No change to Gemini prompt needed.        |
| F-08 | Transcripts not encrypted in transcription path     | `transcriptions.py`         | `_persist_to_db()` now calls `encrypt_data()` and writes `transcript_encrypted` + `transcript_iv`. |
| F-09 | Action items not written to `tasks` table           | `transcriptions.py`         | `_persist_to_db()` now inserts one row per action item into `tasks` after the call record is saved. |
| F-10 | Audio processing blocked the event loop in `calls.py` | `calls.py`               | Wrapped `process_audio_ingest()` in `loop.run_in_executor(None, ...)`.                         |
| F-11 | Auth fail-open on misconfigured server              | `core/auth.py`              | Changed to fail-closed: missing keys → 503 (not silent allow).                                 |
| F-12 | Temp audio written to CWD, not `TEMP_DIR`           | `transcriptions.py`         | Filename parse temp file written to `TEMP_DIR` (imported from `audio_processing_service.py`).  |
| F-13 | Dual transcription paths used different Whisper params | `transcription_service.py` | `transcribe_audio()` updated to use identical params as `_run_transcription()` in `transcriptions.py`. |
| F-14 | Schema validation in `calls.py` was a no-op         | `calls.py`                  | Fixed: now inserts `validated_record.model_dump(exclude_none=True)` instead of raw `record` dict. |
| F-15 | No pipeline states → Sentinel had nothing to monitor | `transcriptions.py`        | Added `pending` stub insert at receipt, `processing` update before Whisper, `completed`/`error` after persist. |
| F-16 | Duplicate `@router.post("/")` in `calls.py`         | `calls.py`                  | Removed redundant decorator; kept only `@router.post("")`.                                      |

---

## 13. The ACR → Horizon Response Contract

ACR Phone reads the `text` field from the JSON response and stores it as the call note on the device. This is the only field ACR Phone uses from the response.

**What ACR Phone sends → What Horizon returns:**

```
ACR Phone POSTs:
  Authorization: Bearer <key>
  Content-Type: multipart/form-data
  model=whisper-1
  Secret=<secret>
  Source=Outgoing
  Number=+15551234567
  Date=1716854400
  Duration=125
  file=<audio_bytes>

Horizon returns (verbose_json):
{
  "task": "transcribe",
  "language": "en",
  "duration": 125.4,
  "text": "━━━ HORIZON EXECUTIVE BRIEF ━━━\n📌 Project discussion...\n\nSummary...\n\nAction Items:\n  • Follow up on...\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n[raw transcript here]",
  "segments": [...],
  "horizon_meta": {
    "contact_name": "Daniel Jeske",
    "phone_number": "+15551234567",
    "call_duration": "125",
    "direction": "outgoing",
    "call_timestamp": "2026-05-27T14:30:22+00:00",
    "model_used": "whisper-1",
    "processing_time_s": 8.342,
    "brief_generated": true,
    "record_id": "uuid-of-call-record"
  }
}
```

If `response_format=json` (some ACR configs): returns only `{"text": "..."}`.
If `response_format=text`: returns plaintext.

---

## 14. Logic Decoupling Rules (Zone Boundaries)

These rules are absolute and must never be violated:

| Action                         | Allowed Zone | Never In   |
|--------------------------------|-------------|------------|
| Gemini API calls               | Zone 2 only | Zone 3     |
| Whisper transcription          | Zone 2 only | Zone 3     |
| Pyannote/NeMo diarization      | Zone 2 only | Zone 3     |
| Google People API calls        | Zone 2 only | Zone 3     |
| Supabase writes                | Zone 2 only | Zone 3     |
| Supabase reads for display     | Zone 3      | —          |
| Supabase Realtime subscriptions | Zone 3     | —          |
| ACR Phone webhook receive      | Zone 2, port 9000 only | port 8000, Zone 3 |

Zone 3 (React/Capacitor) only: displays data that Zone 2 has already processed and stored.

---

## 15. CORS Configuration

```python
# Port 8000 (main.py) — explicit origin list:
CORS_ORIGINS = [
    "http://localhost:5173",   # Vite dev server
    "http://localhost:5174",   # Vite alt port
    "http://localhost:3000",
    "http://localhost:8000",
    "http://localhost",
    "capacitor://localhost",   # Capacitor Android native app
    "https://localhost",
]
allow_origin_regex = r"https?://localhost(:\d+)?"

# Port 9000 (ingestion_server.py) — open wildcard:
allow_origins=["*"]
# Rationale: Port 9000 is Tailscale-isolated. ACR Phone connects from a mobile
# device with a dynamic IP, so restricting by origin is not practical here.
# Security is enforced via the Bearer token, not CORS.
```

---

## 16. Testing the Pipeline

### Run the test script:
```bash
cd mcp-backend
python scripts/test_acr_upload.py                          # Uses synthetic WAV
python scripts/test_acr_upload.py path/to/real_call.m4a   # Uses real audio
```

The script runs four tests in sequence:
1. Health check (`GET /v1/health`) — verifies server is up
2. Outgoing call simulation — exact ACR Phone field names, verbose_json response
3. Incoming call simulation — minimal json response format
4. Bad secret rejection — verifies 401 with wrong `Secret` value
5. Bad Bearer token rejection — verifies 401 with wrong `Authorization` header

### Monitor live requests:
```bash
curl -N -H "Authorization: Bearer <HORIZON_API_KEY>" http://localhost:9000/v1/inspector
```

### Check Sentinel:
```bash
curl http://localhost:9000/v1/sentinel/status
```

---

## 17. Known Limitations and Future Work

| Item                          | Status    | Notes                                                                                         |
|-------------------------------|-----------|-----------------------------------------------------------------------------------------------|
| Speaker diarization           | Planned   | NeMo/TitaNet integration designed but not yet implemented. Currently `direction` field is used to assign speaker labels conceptually. |
| Google People API enrichment  | Planned   | Architecture defined in CONSTITUTION Section 10. Not yet in code path. Unknown numbers stored as `"Unknown"` with stage `"New Lead"`. |
| `tasks.related_call_id` column | Verify   | Insert may fail silently if column doesn't exist. Check schema and add if needed.             |
| Gemini key convention         | Doc debt  | Update CONSTITUTION Section 4 to use `GOOGLE_API_KEY`.                                       |
| Push notification on complete | Planned   | Capacitor push notification when transcription finishes.                                      |
| Confidence score flagging     | Planned   | Flag for manual review if Whisper avg_logprob below threshold.                                |

---

*Last updated: 2026-05-27 — Systematic repair pass (16 findings, all resolved)*
*Author: Horizon Engine — Claude (Anthropic) assisted*
