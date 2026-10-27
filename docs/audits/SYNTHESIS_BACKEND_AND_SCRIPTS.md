# Project Horizon PRM — Backend Python, Tests, Scripts & Database Pearls Synthesis

**Auditor**: Subagent 2 (Backend Python, Tests, Scripts & Database Pearls)  
**Corpus Analyzed**: `C:\Users\legitk1ng\.gemini\antigravity\brain\cff5f4a6-3088-45f8-a8a5-990b80dce038\scratch\corpus` (164 backend/script files across 9 roots + `horizon_corpus_manifest.json`)  
**Canonical Baseline**: `Desktop_horizon` (`mcp-backend/` + `scripts/`)

---

## Executive Summary

Cross-referencing all 164 `.py`, `.ps1`, `.sql`, `.gs`, `.sh`, and `.js` files across the 9 corpus roots against `Desktop_horizon` revealed **three critical categories of findings**:

1. **14 Unique Files ("Pearls") Missing from `Desktop_horizon`**:
   - Most critically, `agents/architecture_artifacts/schema.sql` (`Desktop_unsorted`, `Eclipse_unsorted`, `Imports_legitk1ng`) is the **missing foundational `000_initial_schema.sql`** defining 9 core tables (`contacts`, `organizations`, `call_records`, `entities`, `relationships`, `touchpoints`, `enrichment_jobs`, `user_encryption_keys`, `social_signals`) and 10 indexes that migrations `001`–`003` in `Desktop_horizon/mcp-backend/migrations/` depend on.
   - Other high-value unique pearls include the binary magic-byte drive scanner (`MyDrive_77Horizon_Tools/acr_scanner.py`), the "Vector Prime" SQLite+FTS5+TF-IDF repository knowledge base (`KB/build_kb.py` + `KB/query.py`), the Markdown-to-Kanban extractor (`Imports_legitk1ng/scripts/extract_kanban.py`), the `signal-cli` QR auto-linker (`auto_link.py`), the ACR Gateway PowerShell suite (`Cleanup-Audio.ps1`, `Setup-Gateway.ps1`, `Start-Gateway.ps1`, `Test-Gateway.ps1`), and two unit/integration tests (`test_handshake.py`, `test_schema.py`).
2. **21 Divergent Backend/Script Files with Dropped Features & Regressions in `Desktop_horizon`**:
   - `Desktop_horizon` is NOT a strict superset of `Imports_legitk1ng`, `Imports_Surface3_WP`, `Imports_Surface3_OD`, or `MyDrive_77Horizon_Tools`. Several critical endpoints, regex patterns, security/performance fixes, and protocol compatibility guards were present in `Imports_legitk1ng` or `Imports_Surface3_*` and accidentally dropped in `Desktop_horizon`:
     - **Dropped Endpoints**: `POST /api/v1/batch-ingest/transcribe` (background worker that transcribes `pending` call records), `POST /api/v1/batch-ingest/resolve-stubs` (5-source OSINT phone stub resolver), and `GET /api/v1/data/quality` (17-check data quality endpoint).
     - **Dropped ACR Parser Patterns**: `Desktop_horizon/mcp-backend/services/acr_parser_reference.py` dropped **Pattern T** (Unix millisecond filenames) and **Pattern Z** (2021 date-first format) that exist in `Imports_legitk1ng` and `Desktop_horizon/mcp-backend/utils/naming.py`, while `Desktop_horizon` added **Pattern H2** (2026 bracket format with phone-only contact) which is missing from `utils/naming.py` and `Imports_legitk1ng`.
     - **Dropped `horizon_consolidate_v2.py` Fixes**: `Desktop_horizon/scripts/horizon_consolidate_v2.py` (21,561 B) is an older version missing Pattern T, Pattern Z, Pattern H UUID detection, Pattern C2 head datetime extraction (causes `dt=''` bug), and `st_ctime` fallback—all present in `Imports_Surface3_OD/mcp-backend/horizon_consolidate_v2.py` (23,491 B) and `MyDrive_77Horizon_Tools/horizon_consolidate_v2.py` (29,856 B).
     - **ACR Phone Kotlin SDK Crash Regression**: `Desktop_horizon/mcp-backend/routers/transcriptions.py` injects `"horizon_meta": {...}` into the `verbose_json` response body. As documented in `Imports_legitk1ng`, ACR Phone's `com.aallam.openai` Kotlin SDK uses strict `kotlinx.serialization` and rejects any unknown JSON key; `Imports_legitk1ng` fixed this by moving Horizon metadata into `X-Horizon-*` HTTP response headers.
     - **Coroutine Reuse Bug in `enrichment_service.py`**: `Desktop_horizon` passes an already-instantiated coroutine object `coro` into `run_stage` and awaits it inside a 3-attempt retry loop (`RuntimeError: cannot reuse already awaited coroutine` on retry #2). `Imports_legitk1ng` fixed this using `coro_factory` lambdas.
     - **PBKDF2 100k-Iteration Caching Dropped in `crypto.py`**: `Imports_legitk1ng` caches `_derived_key` after first derivation; `Desktop_horizon` re-runs 100,000 PBKDF2-HMAC-SHA256 iterations on every `encrypt_data()` and `decrypt_data()` call.
3. **Broken Path & Import Wiring in `Desktop_horizon`**:
   - Moving `horizon_supervisor.py`, `ingestion_server.py`, `start.ps1`, `synthesize_contacts.py`, `trigger_contact_sync.py`, `final_data_sync.py`, `run_migrations.py`, and `data_quality_audit.py` from `mcp-backend/` (or repo root) into `Desktop_horizon/scripts/` without updating their `Path(__file__).parent` / `sys.path` / `$ProjectRoot` references **broke startup, module imports, and `.env` loading across all 8 files**.
   - Additionally, `Desktop_horizon/mcp-backend/services/ai_briefing_service.py` migrated to `google-genai` v2 SDK and removed `_get_model()`, which broke `routers/system.py` (line 117) and `services/enrichment_service.py` (line 154) that still execute `from services.ai_briefing_service import _get_model`.

---

## Section 1: Unique Python Scripts, Tests, SQL & Diagnostic Tools (Not in `Desktop_horizon`)

### 1.1 Complete Inventory of Unique Non-Canonical Files

| File (Corpus Source Root) | Size | Also Present In | Purpose & Key Capabilities | Target Location in Consolidated Repo |
| :--- | :---: | :--- | :--- | :--- |
| `Desktop_unsorted/agents/architecture_artifacts/schema.sql` | 8,854 B | `Eclipse_unsorted`, `Imports_legitk1ng` | **Foundational Postgres DDL (`000_initial_schema.sql`)**. Defines 9 core tables (`contacts`, `organizations`, `call_records`, `entities`, `relationships`, `touchpoints`, `enrichment_jobs`, `user_encryption_keys`, `social_signals`) + 10 indexes. | `mcp-backend/migrations/000_initial_schema.sql` |
| `MyDrive_77Horizon_Tools/acr_scanner.py` | 15,435 B | *Unique to `MyDrive_77Horizon_Tools`* | **Binary magic-byte audio scanner**. Scans `C:\` and `G:\` using 19 binary header signatures (`AUDIO_SIGNATURES`: ID3/MP3, FLAC, OGG, RIFF/WAVE, AIFF, WebM, MP4/M4A `ftyp`, `#!AMR`, `IMDI`, 3GPP, DSS/Olympus), classifies filenames against ACR patterns A–K, and outputs `acr_audio_inventory_{TS}.csv`, `acr_pattern_report_{TS}.json`, and `acr_scan_log_{TS}.txt`. | `scripts/acr_scanner.py` |
| `MyDrive_77Horizon_Tools/horizon_consolidate.py` | 15,244 B | *Unique to `MyDrive_77Horizon_Tools`* | **v1 Local Vault Consolidation Script**. Uses size+stem deduplication, `--go` / `--verify` CLI modes, and migrates `C:\Transcription` `.txt`/`.srt`/`.vtt` transcripts and `acr_scanner.py` into `G:\My Drive\Horizon_Data`. Superseded by `horizon_consolidate_v2.py` (which uses MD5), but its `C:\Transcription` transcript-moving logic is preserved in `MyDrive_77Horizon_Tools/horizon_consolidate_v2.py`. | Archive or merge transcript migration into `scripts/horizon_consolidate_v2.py` |
| `KB/build_kb.py` | 21,864 B | *Unique to `KB`* | **"Vector Prime" Offline Knowledge Base Builder**. Indexes canonical `horizon` + `eclipse` repos into SQLite (`kb.sqlite`) with WAL mode, `chunks` + `chunks_fts` (FTS5 full-text index), `symbols` (regex AST extraction for Python, TS/JS, Rust, Go, Java, C#, SQL, CSS), and 60,000-term camelCase/snake_case sub-token TF-IDF vectors + `.vectors_cache.npz`. | `scripts/kb/build_kb.py` |
| `KB/query.py` | 8,824 B | *Unique to `KB`* | **"Vector Prime" CLI Query Engine**. Queries `kb.sqlite` + `.vectors_cache.npz` with subcommands: `hybrid` (Reciprocal Rank Fusion of FTS5 + cosine vector similarity), `search` (FTS5), `vsearch` (pure vector), `symbol` (AST definitions), `files`, and `stats`. | `scripts/kb/query.py` |
| `Imports_legitk1ng/scripts/extract_kanban.py` | 9,645 B | *Unique to `Imports_legitk1ng`* | **Project Horizon Kanban Card Extractor**. Parses 16 markdown review/audit/plan documents + `openclaw-tasks.md`, classifies tasks into columns (`Backlog`, `To Do`, `In Progress`, `Blocked`, `Done`) and categories (`Mobile`, `Testing/QA`, `Backend/Data`, `Frontend/UI`, `Infra/CI`, `Docs`, `Agent/Tooling`), deduplicates titles, and writes `scripts/kanban_cards.json`. | `scripts/extract_kanban.py` |
| `Desktop_unsorted/auto_link.py` | 1,747 B | `Eclipse_unsorted`, `Imports_Surface3_OD`, `Imports_Surface3_WP` (1,795 B CRLF), `Imports_legitk1ng` | **Signal-CLI QR Auto-Linker**. Spawns `.\tools\signal-cli-0.14.2\bin\signal-cli.bat link --name "Horizon PRM"`, captures the `sgnl://` provisioning URI, and renders a fresh QR PNG (`signal_qr_fresh.png`) via `api.qrserver.com` every 50 seconds until linked. | `scripts/tools/auto_link.py` |
| `Imports_Surface3_WP/mcp-backend/test_handshake.py` | 2,113 B | *Unique to `Imports_Surface3_WP`* | **ACR UploadRecordViewModel Handshake Test**. Generates a valid 1-second 16kHz mono silent WAV file (`dummy_test_audio.wav`) and sends a multipart POST (`Secret, Source, Number, Date, Duration, Note, file`) to verify ACR Phone webhook payload handling. | `mcp-backend/tests/test_handshake.py` |
| `Imports_Surface3_WP/mcp-backend/test_schema.py` | 1,319 B | *Unique to `Imports_Surface3_WP`* | **OpenAI Whisper Segment Schema Test**. Verifies that transcription segment dictionaries contain all 10 required non-null primitive keys (`id, seek, start, end, text, tokens, temperature, avg_logprob, compression_ratio, no_speech_prob`) for ACR Phone's Kotlin serializer. | `mcp-backend/tests/test_schema.py` |
| `Imports_Surface3_WP/scripts/Cleanup-Audio.ps1` | 4,081 B | *Unique to `Imports_Surface3_WP`* | **Post-Transcription Audio Cleanup Script**. Scans `recordings/` for audio files (`.mp3, .wav, .m4a, .ogg, .flac, .aac, .opus, .wma, .amr, .3gp`), verifies a matching `.json` transcript exists in `transcripts/` with `.transcript.Count > 0`, and deletes only confirmed-transcribed audio (supports `-DryRun`). | `scripts/gateway/Cleanup-Audio.ps1` |
| `Imports_Surface3_WP/scripts/Setup-Gateway.ps1` | 5,123 B | *Unique to `Imports_Surface3_WP`* | **ACR Gateway Provisioning Script**. Checks Python 3.10+, installs `Gyan.FFmpeg` via `winget`, creates `venv`, installs `requirements.txt`, creates `recordings/` and `transcripts/` dirs, and checks `.env` for `HF_TOKEN`. | `scripts/gateway/Setup-Gateway.ps1` |
| `Imports_Surface3_WP/scripts/Start-Gateway.ps1` | 1,484 B | *Unique to `Imports_Surface3_WP`* | **Standalone Gateway Launcher**. Activates `mcp-backend\venv` and runs `python main.py api` on `0.0.0.0:8000`. | `scripts/gateway/Start-Gateway.ps1` |
| `Imports_Surface3_WP/scripts/Test-Gateway.ps1` | 5,603 B | *Unique to `Imports_Surface3_WP`* | **End-to-End Gateway PowerShell Test**. Checks `/webhook/health`, synthesizes a 44-byte RIFF/WAVE header if `-AudioPath` is omitted, POSTs `multipart/form-data` to `/api/Recording/upload`, and polls `/api/Recording/status/{call_id}` every 3s up to `-TimeoutSeconds`. | `scripts/gateway/Test-Gateway.ps1` |
| `Imports_Surface3_WP/scripts/test_connect.js` | 522 B | *Unique to `Imports_Surface3_WP`* | **Legacy GAS Connectivity Probe**. Node.js IPv4 `https.request` `HEAD` probe testing reachability of the legacy Google Apps Script macro URL. | `scripts/diagnostics/test_connect.js` |
| `Eclipse_unsorted/_reorg_purge.py` & `_reorg_purge2.py` | 5,550 B & 1,556 B | *Unique to `Eclipse_unsorted`* | **"Megatron" Workspace Hygiene Scripts**. Archived auto-generated review files (`review_*.md`), merged `KNOWLEDGE1/2/3.md` into `docs/KNOWLEDGE.md`, relocated root tests/scripts, and wrote `REORG_MANIFEST.json`. | `scripts/maintenance/_reorg_purge.py` |

---

### 1.2 Critical Database Pearl Analysis: `schema.sql` vs `mcp-backend/migrations/`

In `Desktop_horizon/mcp-backend/migrations/`, only three SQL migration files exist:
- `001_actions_and_entities.sql` (creates `tasks`, `projects`, `entities` [Item 13 graph schema], `embeddings`, `search_calls_semantic()` RPC, and `ALTER TABLE call_records ADD COLUMN IF NOT EXISTS embedding vector(768)`)
- `002_call_recordings.sql` (creates `call_recordings` with `contact_id UUID REFERENCES contacts(id)`)
- `003_call_records_acr_metadata.sql` (`ALTER TABLE call_records ADD COLUMN IF NOT EXISTS acr_pattern ...`)

**Problem 1 — Missing Base Tables (`000_initial_schema.sql`)**:  
None of `001`, `002`, or `003` create `contacts`, `organizations`, `call_records`, `relationships`, `touchpoints`, `enrichment_jobs`, `user_encryption_keys`, or `social_signals`! Those tables are defined in `Desktop_unsorted/agents/architecture_artifacts/schema.sql` (and partially embedded inside `scripts/run_migrations.py`, which omits `call_records`).

**Problem 2 — Table Name Collision on `entities` (`schema.sql` vs `001_actions_and_entities.sql`)**:
- In `schema.sql` (and `scripts/run_migrations.py`), `entities` is the **REQ-018 / REQ-029 Contact Field Provenance table**:
  ```sql
  CREATE TABLE IF NOT EXISTS entities (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      contact_id  UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      field_type  TEXT NOT NULL,
      value       TEXT NOT NULL,
      confidence  NUMERIC(3,2) CHECK (confidence >= 0 AND confidence <= 1),
      source      TEXT NOT NULL,
      fetched_at  TIMESTAMPTZ NOT NULL,
      override_by TEXT,
      override_at TIMESTAMPTZ,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  ```
  This schema is actively queried by `services/enrichment_service.py` (`apply_user_override`: updates `value, override_by, override_at` on `entities`) and `routers/enrichments.py` (`GET /api/v1/enrichments/{contact_id}/provenance`: selects `entities` where `contact_id = ...`).
- In `001_actions_and_entities.sql`, `entities` is defined as the **Item 13 Named Entity Graph table**:
  ```sql
  CREATE TABLE IF NOT EXISTS entities (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      type            TEXT NOT NULL,  -- person | organization | topic | location | product
      name            TEXT NOT NULL,
      normalized_name TEXT NOT NULL,
      aliases         TEXT[] DEFAULT '{}',
      metadata        JSONB DEFAULT '{}',
      relationship_ids UUID[] DEFAULT '{}',
      created_at      TIMESTAMPTZ DEFAULT now(),
      updated_at      TIMESTAMPTZ DEFAULT now()
  );
  ```
  This schema is queried by `routers/actions.py` (`GET /api/v1/entities` and `POST /api/v1/entities`).
- **Additionally**, `scripts/apply_migrations.py` defines a *third* incompatible schema for `entities`, `relationships`, and `touchpoints`!
- **Consolidation Fix Required**:
  1. Promote `schema.sql` to `mcp-backend/migrations/000_initial_schema.sql`.
  2. Reorder `organizations` **before** `contacts` in `000_initial_schema.sql` (because `contacts.organization_id REFERENCES organizations(id)` fails if `organizations` does not exist yet).
  3. Add the missing columns on `contacts` (`first_name`, `last_name`, `full_name`, `organization`, `birthdate`, `photo_url`, `google_resource_name UNIQUE`, `last_synced`, `raw_data JSONB`, `user_id UUID`, `is_favorite BOOLEAN`) and `call_records` (`external_id TEXT UNIQUE`, `audio_path TEXT`, `raw_transcript TEXT`, `transcript TEXT`, `user_id UUID`) that the Python services actively read/write.
  4. Resolve the `entities` collision by either renaming the REQ-018 provenance table to `contact_field_provenance` (or adding `contact_id, field_type, value, confidence, source, fetched_at, override_by, override_at` columns so both uses coexist without error).

---

## Section 2: Line-by-Line Code Divergence Analysis (`mcp-backend/` & `scripts/`)

### 2.1 Files That Differ Only by Line Endings (`CRLF` vs `LF`) — And Their Path Relocations
The following 12 files in `Imports_Surface3_WP` had different MD5 hashes in `horizon_corpus_manifest.json` **solely due to `\r\n` vs `\n` line endings** (0 code differences), **but 7 of them were relocated from `mcp-backend/` to `scripts/` in `Desktop_horizon`**:

| `Imports_Surface3_WP` Path | `Desktop_horizon` Path | Content Status | Relocation Impact |
| :--- | :--- | :---: | :--- |
| `mcp-backend/apply_migrations.py` | `scripts/apply_migrations.py` | Identical (CRLF) | Standalone (hardcoded token) |
| `mcp-backend/data_quality_audit.py` | `scripts/data_quality_audit.py` | Identical (CRLF) | **BROKEN `.env` path** (`BASE_DIR/.env`) |
| `mcp-backend/final_data_sync.py` | `scripts/final_data_sync.py` | Identical (CRLF) | **BROKEN `.env` & `services/acrphonebackup.json` path** |
| `mcp-backend/run_migrations.py` | `scripts/run_migrations.py` | Identical (CRLF) | **BROKEN `.env` path** (`Path(__file__).parent / ".env"`) |
| `mcp-backend/synthesize_contacts.py` | `scripts/synthesize_contacts.py` | Identical (CRLF) | **BROKEN `from services...` import & `BACKUP_PATH`** |
| `mcp-backend/trigger_contact_sync.py` | `scripts/trigger_contact_sync.py` | Identical (CRLF) | **BROKEN `from services...` import** |
| `update.ps1` | `scripts/update.ps1` | Identical (CRLF) | Assumes `cwd` is repo root |
| `mcp-backend/debug_startup.py` | `mcp-backend/debug_startup.py` | Identical (CRLF) | None |
| `mcp-backend/diagnostic_check.py` | `mcp-backend/diagnostic_check.py` | Identical (CRLF) | Uses deprecated `google.generativeai` |
| `mcp-backend/list_models.py` | `mcp-backend/list_models.py` | Identical (CRLF) | Uses deprecated `google.generativeai` |
| `mcp-backend/test_statuses.py` | `mcp-backend/test_statuses.py` | Identical (CRLF) | Archived guard script |
| `mcp-backend/test_statuses_v2.py` | `mcp-backend/test_statuses_v2.py` | Identical (CRLF) | Archived guard script |

---

### 2.2 Detailed Code Divergences Across the 21 Non-Identical Backend/Script Files

#### 1. `services/acr_parser_reference.py` & `utils/naming.py` (3-Way Split!)
- **Versions Compared**:
  - `MyDrive_77Horizon_Tools/acr_parser_reference.py` (45,163 B, 1,148 lines)
  - `Imports_legitk1ng/mcp-backend/services/acr_parser_reference.py` (24,311 B, 631 lines; identical in `Imports_Surface3_OD`)
  - `Desktop_horizon/mcp-backend/services/acr_parser_reference.py` (22,088 B, 565 lines; identical in `Imports_Surface3_WP`)
  - `Desktop_horizon/mcp-backend/utils/naming.py` (11,170 B, 279 lines)
- **Exact Divergences**:
  1. **Pattern T (`dt_from_unix_ms`, lines 134–140 & 234–245 of `Imports_legitk1ng`) — DROPPED in `Desktop_horizon/mcp-backend/services/acr_parser_reference.py`**:
     - Matches `16518414502-12229622854-1752794711955` (`{phone}-{call_id}-{unix_ms_13digits}`):
       ```python
       def dt_from_unix_ms(ms_str: str) -> str:
           try:
               return datetime.fromtimestamp(int(ms_str) / 1000, tz=timezone.utc).strftime('%Y-%m-%d_%H%M%S')
           except Exception:
               return 'NODATE'
       ```
       ```python
       m = re.match(r'^(\+?1?\d{10,15})-(\d+)-(\d{13,})$', s)
       if m:
           return dict(pattern='T', dt=dt_from_unix_ms(m.group(3)), direction='', channel='phone',
                       phone=norm_phone(m.group(1)), contact='', ch_idx='', confidence='medium',
                       notes=f'call_id={m.group(2)}')
       ```
     - Without Pattern T, `Desktop_horizon`'s `acr_parser_reference.py` misclassifies these files or falls through to Pattern X!
  2. **Pattern Z (`2021-10-08 17-37-46 (phone) ...`, lines 269–295 of `Imports_legitk1ng`) — DROPPED in `Desktop_horizon/mcp-backend/services/acr_parser_reference.py`**:
     - Matches 2021 ACR format where date comes before `(phone|facebook|messenger|zoom|mic)`.
  3. **Emoji/Non-ASCII Sanitization in `slugify()` (line 95 of `Imports_legitk1ng`) — DROPPED in `Desktop_horizon`**:
     - `Imports_legitk1ng` strips non-ASCII characters (`s = re.sub(r'[^\x00-\x7F]', '', s)`) before slugifying so contacts with emojis (e.g. `Chris C Locksmith 🔑`) don't produce trailing underscores or encoding errors on Windows.
  4. **Time-Fragment FB Label Guard (line 119 of `Imports_legitk1ng`) — DROPPED in `Desktop_horizon`**:
     - `Imports_legitk1ng` checks `if re.match(r'^\d+[:\s]\d{2}$', label): return True` in `_is_fb_system_label()` so Facebook call duration fragments (`"0:37"`) aren't treated as contact names.
  5. **Pattern H2 (lines 204–215 of `Desktop_horizon/mcp-backend/services/acr_parser_reference.py`) — UNIQUE to `Desktop_horizon` (missing from `Imports_legitk1ng` and `utils/naming.py`)**:
     - Matches 2026 ACR Phone bracket format when contact is an unsaved phone number (`+16512495738 [2026-04-28 15-42-22] [Outgoing]`):
       ```python
       m = re.match(
           r'^(\+[\d]{7,15})\s*\[(\d{4}-\d{2}-\d{2})\s+(\d{2}-\d{2}-\d{2})\]\s*\[(Incoming|Outgoing)\](?:\s*\[([^\]]*)\])?$',
           s, re.IGNORECASE,
       )
       ```
  6. **600-Line Reference Documentation + 21 Self-Tests (`TEST_FILES`) in `MyDrive_77Horizon_Tools/acr_parser_reference.py`**:
     - Contains the complete human/AI reference documentation of all ACR patterns, sidecar formats, and 21 test cases.
- **Consolidation Action**: Merge Pattern T, Pattern Z, `slugify()` ASCII stripping, and the time-fragment FB guard from `Imports_legitk1ng` WITH Pattern H2 from `Desktop_horizon` into **both** `mcp-backend/services/acr_parser_reference.py` and `mcp-backend/utils/naming.py` (or have `acr_parser_reference.py` import directly from `utils/naming.py` to eliminate duplication!).

---

#### 2. `horizon_consolidate_v2.py` (3-Way Split!)
- **Versions Compared**:
  - `Desktop_horizon/scripts/horizon_consolidate_v2.py` (21,561 B; identical in `Imports_Surface3_WP/mcp-backend/`)
  - `Imports_Surface3_OD/mcp-backend/horizon_consolidate_v2.py` (23,491 B; identical in `Imports_legitk1ng/mcp-backend/`)
  - `MyDrive_77Horizon_Tools/horizon_consolidate_v2.py` (29,856 B)
- **Exact Divergences**:
  1. **Bug in `Desktop_horizon` Pattern C2 (lines 177–181)**: In `Desktop_horizon`, Pattern C2 checks `if m and re.match(r'^\d{4}\s+\d{2}', s):` and immediately returns `dict(pattern='C2', dt=dt, ...)` **before `dt` is populated** (so `dt` is always `""`!). Both `Imports_Surface3_OD` and `MyDrive_77Horizon_Tools` fix this by extracting `head_m = re.match(r'^(\d{4})\s+(\d{2})\s+(\d{2})_(\d{2})\s+(\d{2})\s+(\d{2})', s)` and setting `dt = fmt_dt(...)`.
  2. **Missing Patterns in `Desktop_horizon`**: `Desktop_horizon` is missing Pattern T (`dt_from_unix_ms`), Pattern Z (2021 date-first), Pattern H UUID contact filtering (`^[0-9a-f]{8}-...` -> `contact=''`), Pattern E/F routing when `rest.lower() == 'unknown'`, and `file_path.stat().st_ctime` fallback for Pattern K/X—all present in `Imports_Surface3_OD` and `MyDrive_77Horizon_Tools`.
  3. **Missing Features from `MyDrive_77Horizon_Tools` (29,856 B)**: `MyDrive_77Horizon_Tools/horizon_consolidate_v2.py` also includes:
     - `error_log_{TS}.csv` generation for failed/unmatched files
     - Migration of `C:\Transcription` `.txt`, `.srt`, and `.vtt` transcript files into `02_Processed_Vault\Transcripts_JSON`
     - Archiving `acr_scanner.py` into `04_Pipeline_Tools`.
- **Consolidation Action**: Replace `scripts/horizon_consolidate_v2.py` with `MyDrive_77Horizon_Tools/horizon_consolidate_v2.py` + Pattern H2 from `Desktop_horizon`.

---

#### 3. `routers/batch_ingest.py` & `services/batch_ingest_service.py`
- **Versions Compared**:
  - `Imports_legitk1ng/mcp-backend/routers/batch_ingest.py` (14,770 B) + `services/batch_ingest_service.py` (6,844 B)
  - `Desktop_horizon/mcp-backend/routers/batch_ingest.py` (6,961 B) + `services/batch_ingest_service.py` (7,517 B)
- **Exact Divergences**:
  1. **`Desktop_horizon` Unique Features**:
     - `POST /api/v1/batch-ingest` supports `source="wifi"` (`services.acr_wifi_service.wifi_batch_ingest`) in addition to `source="folder"`.
     - `GET /api/v1/batch-ingest/probe?url=...` probes ACR Phone's WiFi server endpoints (`/`, `/list`, `/recordings`, `/files`, `/api/list`, `/api/recordings`).
  2. **`Imports_legitk1ng` Unique Endpoints (DROPPED in `Desktop_horizon`)**:
     - **`POST /api/v1/batch-ingest/transcribe` (lines 118–260 of `Imports_legitk1ng`)**: Background worker `_run_transcription_worker(db, limit, re_resolve_contacts)` that queries `call_records` where `status='pending'` and `audio_path IS NOT NULL`, converts audio to WAV via `process_audio_ingest`, runs `transcribe_audio`, generates `executive_brief` via `generate_call_brief`, links contacts, and updates `call_records` to `status='completed'`.
     - **`POST /api/v1/batch-ingest/resolve-stubs` (lines 285–405 of `Imports_legitk1ng`)**: Queries `contacts` where `tags @> ['auto-stub']` and `full_name LIKE 'Unknown:%'`, runs reverse phone lookup, and either merges stub `call_records` into an existing named contact or updates the stub contact's name.
     - **Live DB Counts in `GET /api/v1/batch-ingest/status` (lines 94–111 of `Imports_legitk1ng`)**: Queries live `call_records` counts by status (`pending`, `completed`, `error`, `processing`) in addition to returning `_last_run` and `_last_transcribe`.
  3. **Table Target Mismatch in `services/batch_ingest_service.py`**:
     - `Desktop_horizon`'s `batch_ingest_service.py` writes only to `call_recordings` with `status="QUEUED"` (which `vault_scanner_service.py` explicitly notes in its docstring: *"the batch folder ingestor only lands rows in `call_recordings` with status=QUEUED, which no code path ever transcribes"*).
     - `Imports_legitk1ng`'s `batch_ingest_service.py` writes to `call_records` (`on_conflict="external_id"`, `status="pending"`, `audio_path=str(audio_path.resolve())`), which directly feeds the `/batch-ingest/transcribe` worker and `HorizonSentinel`!
  4. **Missing Helper Module Caveat**: `Imports_legitk1ng` imports `from services.phone_resolver import resolve_contact` and `from services.reverse_lookup_service import lookup_phone`, neither of which exists in the corpus. When merging `/transcribe` and `/resolve-stubs` into `Desktop_horizon`, use `_link_contact()` (from `Desktop_horizon/mcp-backend/services/batch_ingest_service.py` lines 85–106) and `_stage_phone_lookup()` (from `services/enrichment_service.py` lines 66–85).

---

#### 4. `routers/transcriptions.py`
- **Versions Compared**:
  - `Imports_legitk1ng/mcp-backend/routers/transcriptions.py` (15,286 B, 390 lines; identical in `Imports_Surface3_OD`)
  - `Desktop_horizon/mcp-backend/routers/transcriptions.py` (26,644 B, 580 lines; identical in `Imports_Surface3_WP`)
- **Exact Divergences**:
  1. **CRITICAL — ACR Phone `kotlinx.serialization` Crash in `Desktop_horizon` (lines 329–347)**:
     - `Desktop_horizon` returns `"horizon_meta": { ... }` inside the `verbose_json` JSON body.
     - As documented in `Imports_legitk1ng` (lines 212–246):
       > *"IMPORTANT: ACR Phone uses `com.aallam.openai` Kotlin SDK with strict `kotlinx.serialization`. Any unknown JSON key causes `'Illegal input'` error. Horizon extensions are sent as `X-Horizon-*` headers instead of body fields."*
     - Also, `Desktop_horizon`'s `TranscriptionManager.run_transcription()` (in `services/transcription_service.py` lines 74–88) uses `getattr(s, "seek", 0)` instead of `int(getattr(s, "seek", None) or 0)`. When `faster-whisper` returns `s.seek = None` or `s.tokens = None`, `getattr(s, "seek", 0)` returns `None` (because the attribute exists and its value is `None`!), which causes ACR Phone's Kotlin `Segment` deserializer to crash on `null`! `Imports_legitk1ng` (lines 66–75) uses `or` guards (`int(getattr(s, "seek", None) or 0)`, `list(getattr(s, "tokens", None) or [])`, etc.) so `None` values are coerced to valid primitives.
  2. **Unix Timestamp Normalization Dropped in `Desktop_horizon` (lines 132–135)**:
     - ACR Phone sends `Date` as a Unix integer (seconds or milliseconds). `Imports_legitk1ng` (lines 140–149) converts `Date` to ISO-8601 UTC (`ts = date_unix if date_unix < 1e11 else date_unix / 1000; effective_timestamp = datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()`).
     - `Desktop_horizon` reads `_date_val = str(_raw.get("Date", ""))` and passes the raw integer string (e.g. `"1712345678"`) directly into Postgres `TIMESTAMPTZ` column `call_records.timestamp`, which fails Postgres timestamp parsing!
  3. **Dual Route Decorator Dropped in `Desktop_horizon`**:
     - `Imports_legitk1ng` registers both `@router.post("/transcriptions")` and `@router.post("/audio/transcriptions")`.
  4. **Strengths in `Desktop_horizon` to Preserve**:
     - Offloading `process_audio_ingest` and `_run_transcription` to `loop.run_in_executor` so the FastAPI event loop doesn't block during CPU-intensive Whisper inference.
     - Enriching missing form fields from the filename via `full_parse(temp_meta_path)`.
     - Inserting a `pending` -> `processing` stub row into `call_records` before Whisper starts, then updating to `completed`/`error` and creating `tasks` rows (`F-09`) + emitting Realtime events (`emit_event`).
     - Formatting the `text` field with `_format_enriched_response(transcript_text, executive_brief)` so ACR Phone saves the executive brief in the device's call note.

---

#### 5. `routers/data.py`
- **Versions Compared**:
  - `Imports_legitk1ng/mcp-backend/routers/data.py` (4,472 B, 123 lines)
  - `Desktop_horizon/mcp-backend/routers/data.py` (2,756 B, 83 lines)
- **Exact Divergences**:
  1. **`GET /api/v1/data/quality` Endpoint (lines 88–123 of `Imports_legitk1ng`) — DROPPED in `Desktop_horizon`**:
     - Runs data quality checks across `call_records` and `contacts` and returns `{overall_passed, summary, checks: [{name, dimension, severity, passed, total, violations, pct_passing, detail}]}`.
  2. **RPC Optimization in `GET /api/v1/data/stats` (lines 28–40 of `Imports_legitk1ng`)**:
     - Uses `_sql_avg_health(db)` trying `db.rpc("avg_contact_health", {})` before falling back to full-table Python averaging, and uses a clean `_count(db, table, **filters)` helper.

---

#### 6. `routers/calls.py`
- **Versions Compared**:
  - `Imports_legitk1ng/mcp-backend/routers/calls.py` (7,896 B, 203 lines)
  - `Desktop_horizon/mcp-backend/routers/calls.py` (10,655 B, 267 lines)
- **Exact Divergences & Bug in `Desktop_horizon`**:
  1. **`Desktop_horizon` Additions**: Adds `PATCH /api/v1/calls/{call_id}` (`update_call`), runs `process_audio_ingest` in `loop.run_in_executor`, validates via `CallRecordCreate(**record)`, and cleans up `wav_path` in `finally:`.
  2. **BUG in `Desktop_horizon/mcp-backend/routers/calls.py` (lines 96–128)**:
     - Lines 98–99 compute:
       ```python
       transcript_encrypted, transcript_iv = encrypt_data(transcript)
       ```
       And then lines 113–128 construct `record = { ... }` **without including `"transcript_encrypted": transcript_encrypted` or `"transcript_iv": transcript_iv`!** The encrypted transcript is computed and immediately thrown away!
  3. **Trailing Slash Route in `Imports_legitk1ng`**:
     - `Imports_legitk1ng` has both `@router.post("")` and `@router.post("/")` on `ingest_call`. Because `main.py` sets `redirect_slashes=False`, `POST /api/v1/calls/` (which `scripts/test_acr_ingest.py` calls on line 8!) returns **404 Not Found** in `Desktop_horizon` unless `@router.post("/")` is also present!

---

#### 7. `core/api_key_auth.py`, `core/auth.py`, and `core/security/crypto.py`
- **`core/api_key_auth.py`**:
  - `Imports_legitk1ng` (lines 14–42) accepts `Secret: Optional[str] = Form(None)` as a fallback when `Authorization: Bearer` header is not provided by ACR Phone. `Desktop_horizon` dropped `Secret: Optional[str] = Form(None)` and immediately raises 401 if the `Authorization` header is missing.
- **`core/auth.py`**:
  - `Desktop_horizon` (lines 17–22) is superior: fails closed (`HTTP_503_SERVICE_UNAVAILABLE`) when neither `HORIZON_API_KEY` nor `ACR_WEBHOOK_SECRET` is configured, whereas `Imports_legitk1ng` failed open.
- **`core/security/crypto.py`**:
  - `Imports_legitk1ng` (lines 16–39) caches `_derived_key: bytes | None = None` at module level so `PBKDF2HMAC` (100,000 iterations of SHA-256) runs only once per process, and uses `logger` instead of `print()`. `Desktop_horizon` dropped the cache and re-derives the PBKDF2 key on every single encrypt/decrypt call.

---

#### 8. `services/ai_briefing_service.py`, `services/enrichment_service.py`, and `routers/ai.py`
- **`services/ai_briefing_service.py`**:
  - `Desktop_horizon` migrated from deprecated `google-generativeai` (`import google.generativeai as genai`) to the `google-genai>=1.16.0` v2 SDK (`from google import genai`) and added `chat_gemini_sync(prompt: str) -> str`.
  - **BROKEN SYMBOL EXPORT**: Removing `_get_model()` in `Desktop_horizon`'s `ai_briefing_service.py` broke:
    1. `Desktop_horizon/mcp-backend/routers/system.py` line 117 (`from services.ai_briefing_service import _get_model` in `GET /api/v1/system/test-gemini`)
    2. `Desktop_horizon/mcp-backend/services/enrichment_service.py` line 154 (`from services.ai_briefing_service import _get_model` in `_stage_ai_synthesis`)
  - Also, `Imports_legitk1ng` had a `_parse_json(text, context)` helper that logged raw model output snippets on `JSONDecodeError`.
- **`services/enrichment_service.py`**:
  - **CRITICAL BUG in `Desktop_horizon` (lines 179–230)**: `run_stage(stage, coro, source)` receives an already-created coroutine object (e.g. `_stage_phone_lookup(phone)`) and awaits it inside `for attempt in range(1, 4): result = await coro`. If attempt 1 raises an exception, attempt 2 raises `RuntimeError: cannot reuse already awaited coroutine`! `Imports_legitk1ng` (lines 179–234) fixed this by passing a zero-arg callable `coro_factory` (`lambda: _stage_phone_lookup(phone)`, `lambda d=dict(enrichment_data): _stage_ai_synthesis(contact_name, d)`).
  - **Security Fix in `Imports_legitk1ng` (line 74)**: Uses `https://apilayer.net/api/validate` instead of `Desktop_horizon`'s cleartext `http://apilayer.net/api/validate`.
- **`routers/enrichments.py`**:
  - In `PATCH /api/v1/enrichments/override`, `Imports_legitk1ng` resolves the real `user_id` from `db.table("profiles").select("id").limit(1).execute()`, whereas `Desktop_horizon` passes hardcoded `"default"`.
- **`routers/ai.py`**:
  - `Desktop_horizon` routes `POST /api/v1/ai/chat` through Gemini 2.0 Flash (`await asyncio.to_thread(chat_gemini_sync, full_prompt)`), whereas `Imports_legitk1ng` routes through `ollama_generate(full_prompt, model=DEFAULT_MODEL)`. (Could support Gemini primary with Ollama fallback or vice versa).

---

#### 9. `services/audio_processing_service.py`, `services/google_people_service.py`, `services/nudge_service.py`, `services/transcription_service.py`
- **`services/audio_processing_service.py`**:
  - `Desktop_horizon` added `_extract_ffmpeg_error(stderr)` and `-hide_banner` + `encoding="utf-8", errors="replace"`.
  - `Imports_legitk1ng` (lines 55–66, 73–80, 88–100) has 5-attempt `PermissionError` (`WinError 32`) retry loops with `time.sleep(0.1)` around `input_path.unlink()` and `cleanup_processed_audio()`. `Desktop_horizon` dropped the Windows file-lock retry loops! Both should be combined.
- **`services/google_people_service.py`**:
  - `Imports_legitk1ng` (lines 59–70) parses Google OAuth error JSON in `refresh_access_token` and, when `error_msg == "invalid_grant"`, broadcasts an SSE event to the UI (`await broadcast("system:auth_required", {"service": "google", "message": "Google session expired. Please re-authenticate."})`). `Desktop_horizon` dropped this!
- **`services/nudge_service.py`**:
  - `Imports_legitk1ng` calls `get_supabase()` (reusing the initialized singleton client), whereas `Desktop_horizon` calls `init_supabase()` on every `get_at_risk_contacts()` and `check_immediate_alerts()` call (creating a brand-new Supabase client every time) and has an unused `from services.health_service import calculate_health_score` import.
- **`services/transcription_service.py`**:
  - `Desktop_horizon` is much more complete (adds `TranscriptionManager.run_transcription()` with VAD filtering `vad_filter=True`, `min_silence_duration_ms=500`, `condition_on_previous_text=False`, and `no_speech_prob < 0.8` hallucination filtering), **except** lines 77–86 need the `or` primitive coercion guards from `Imports_legitk1ng/mcp-backend/routers/transcriptions.py` (lines 67–75) so `None` attributes never leak into `segments_list`.

---

#### 10. `mcp-backend/main.py`, `scripts/ingestion_server.py`, `scripts/horizon_supervisor.py`, `mcp-backend/requirements.txt`
- **`mcp-backend/main.py`**:
  - `Desktop_horizon` (9,611 B) is the most complete version: includes `_RateLimitMiddleware`, `_MaxBodySizeMiddleware` (100 MB), `lifespan` with `init_supabase()` and optional `HorizonSentinel` (`ENABLE_SENTINEL_IN_API`), `redirect_slashes=False`, all 14 routers, and `/api/v1/health` with live DB ping (`"connected"` vs `"error: ..."`).
  - Note: `Imports_Surface3_WP/mcp-backend/main.py` also mounted `transcriptions.router` on `main.py` at `/v1` (`app.include_router(transcriptions.router, prefix="/v1")`) so port 8000 could also serve `/v1/transcriptions` if port 9000 wasn't used.
- **`mcp-backend/requirements.txt`**:
  - `Imports_Surface3_OD` and `Imports_legitk1ng` include `beautifulsoup4` (line 7), which was dropped in `Desktop_horizon/mcp-backend/requirements.txt`, while `Desktop_horizon` updated `google-generativeai` to `google-genai>=1.16.0`. Both `beautifulsoup4` and `google-genai>=1.16.0` should be included.

---

## Section 3: Broken Wiring, Path & Import Fixes Needed in `Desktop_horizon`

During the reorganization that created `Desktop_horizon`, several operational scripts and servers were moved from the repo root or `mcp-backend/` into `Desktop_horizon/scripts/` **without updating their relative path calculations or `sys.path`**. Below is the complete list of broken files in `Desktop_horizon` and the exact fixes required:

### 3.1 Critical Startup & Supervisor Path Breakages

| File in `Desktop_horizon` | Lines | Exact Bug / Broken Assumption | Required Fix |
| :--- | :---: | :--- | :--- |
| `scripts/start.ps1` | 7–10, 22 | Was moved from repo root into `scripts/`. Line 7 sets `$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path`, which now resolves to `Desktop_horizon\scripts`! Consequently:<br>• `$BackendDir` resolves to `Desktop_horizon\scripts\mcp-backend` (non-existent)<br>• `$VenvPython` resolves to `Desktop_horizon\scripts\.venv\Scripts\python.exe` (non-existent)<br>• Line 22 runs `Set-Location '$BackendDir'; & '$VenvPython' horizon_supervisor.py`, which also fails because `horizon_supervisor.py` was moved out of `mcp-backend/` into `scripts/`! | Set `$ProjectRoot = Split-Path -Parent $PSScriptRoot` (parent of `scripts/`), and either move `horizon_supervisor.py` & `ingestion_server.py` back into `mcp-backend/` OR invoke `..\scripts\horizon_supervisor.py` with `cwd = $BackendDir`. |
| `scripts/horizon_supervisor.py` | 50, 179–196 | Was moved from `mcp-backend/` into `scripts/`. Line 50 sets `BACKEND_DIR = Path(__file__).parent.resolve()`, which now resolves to `Desktop_horizon/scripts` instead of `Desktop_horizon/mcp-backend`!<br>• `_load_dotenv()` looks for `scripts/.env` instead of `mcp-backend/.env`.<br>• `uvicorn main:app` fails because `main.py` is in `mcp-backend/`, not `scripts/`. | Either move `horizon_supervisor.py` back to `mcp-backend/horizon_supervisor.py` (recommended, matches `start.ps1` and `CONSTITUTION.md`), OR change line 50 to `BACKEND_DIR = (Path(__file__).resolve().parent.parent / "mcp-backend")`. |
| `scripts/ingestion_server.py` | 31, 41, 102–114 | Was moved from `mcp-backend/` into `scripts/`.<br>1. Line 31: `_env_path = os.path.join(os.path.dirname(__file__), ".env")` looks for `scripts/.env` instead of `mcp-backend/.env` (and is missing `override=True` from `Imports_Surface3_WP`).<br>2. Lines 41, 102, 108, 114: `from core.windows_patches import ...`, `from middleware.inspector import ...`, `from routers import transcriptions`, `from services.scanner_router import ...` all raise `ModuleNotFoundError` unless `mcp-backend/` is on `sys.path` or `ingestion_server.py` resides inside `mcp-backend/`! | Move `ingestion_server.py` back to `mcp-backend/ingestion_server.py` (where `uvicorn ingestion_server:app` in `horizon_supervisor.py` expects it!) and use `load_dotenv(_env_path, override=True)`. |
| `scripts/watch_pipeline.ps1` | 22–23 | Assumes `cwd` is repo root and calls `.\mcp-backend\venv\Scripts\python.exe` (whereas `start.ps1` uses `.venv\Scripts\python.exe`). | Resolve `$ProjectRoot = Split-Path -Parent $PSScriptRoot` and check both `.venv` and `mcp-backend\venv`. |
| `scripts/update.ps1` | 4–14 | Assumes `cwd` is repo root when running `git pull`, `npm install`, and `Test-Path ".venv"`. | Add `$ProjectRoot = Split-Path -Parent $PSScriptRoot; Set-Location $ProjectRoot` at top of script. |

### 3.2 Broken Data Sync, Migration & Audit Scripts in `Desktop_horizon/scripts/`

| File in `Desktop_horizon` | Lines | Exact Bug / Broken Assumption | Required Fix |
| :--- | :---: | :--- | :--- |
| `scripts/run_migrations.py` | 12 | `load_dotenv(Path(__file__).parent / ".env")` looks for `scripts/.env` instead of `mcp-backend/.env`, causing `KeyError: 'SUPABASE_URL'` on line 14. | Change to `load_dotenv(Path(__file__).resolve().parent.parent / "mcp-backend" / ".env")`. |
| `scripts/data_quality_audit.py` | 89–91, 100 | `env_path = os.path.join(BASE_DIR, ".env")` looks for `scripts/.env` instead of `mcp-backend/.env`. Also line 100 hardcodes `VAULT = r"C:\Users\owner\My Drive\Horizon_Data"`. | Load `.env` from `../mcp-backend/.env` and read `VAULT` from `os.getenv("HORIZON_VAULT_PATH", r"G:\My Drive\Horizon_Data")`. |
| `scripts/final_data_sync.py` | 15–20 | `BACKUP_PATH = os.path.join(BASE_DIR, "services", "acrphonebackup.json")` and `env_path = os.path.join(BASE_DIR, ".env")` look inside `scripts/` instead of `mcp-backend/`. | Point `BACKEND_DIR` to `Path(__file__).resolve().parent.parent / "mcp-backend"`. |
| `scripts/synthesize_contacts.py` | 1–60, 161 | 1. Lines 1–28 are a duplicated header block (lines 29–60 repeat the imports and setup).<br>2. Line 38: `from services.google_people_service import GooglePeopleService` raises `ModuleNotFoundError: No module named 'services'` when run from `scripts/`.<br>3. Line 48: `BACKUP_PATH` looks in `scripts/services/acrphonebackup.json`. | Remove duplicate lines 1–28, insert `mcp-backend` into `sys.path`, and resolve `.env` and `BACKUP_PATH` relative to `mcp-backend/`. |
| `scripts/trigger_contact_sync.py` | 6, 12 | `from services.google_people_service import GooglePeopleService` raises `ModuleNotFoundError` because `mcp-backend` is not in `sys.path`, and `load_dotenv()` doesn't find `mcp-backend/.env`. | Add `mcp-backend` to `sys.path` and load `mcp-backend/.env`. |

### 3.3 Broken Imports & Runtime Bugs Inside `Desktop_horizon/mcp-backend/`

| File in `Desktop_horizon/mcp-backend` | Lines | Exact Bug | Required Fix |
| :--- | :---: | :--- | :--- |
| `routers/system.py` | 117 | `from services.ai_briefing_service import _get_model` in `GET /api/v1/system/test-gemini` raises `ImportError: cannot import name '_get_model'` because `ai_briefing_service.py` was migrated to `google-genai` v2 SDK (`_generate()` / `_get_client()`). | Replace with `from services.ai_briefing_service import _generate` and call `_generate("Hello. Respond with 'Gemini Online'.")`. |
| `services/enrichment_service.py` | 154, 179–230 | 1. Line 154: `from services.ai_briefing_service import _get_model` raises `ImportError`.<br>2. Lines 179–230: `run_stage` awaits an already-instantiated coroutine `coro` inside a 3-attempt retry loop (`RuntimeError: cannot reuse already awaited coroutine` on retry). | 1. Use `_generate(prompt)` from `services.ai_briefing_service`.<br>2. Port `coro_factory` lambdas from `Imports_legitk1ng/mcp-backend/services/enrichment_service.py` (lines 179–234). |
| `services/consolidation_service.py` | 90 | Calls `os.walk(source_dir, topdown=False)` but **`import os` is missing** at top of file (`NameError: name 'os' is not defined`). | Add `import os` at top of `services/consolidation_service.py`. |
| `routers/calls.py` | 98–128 | Computes `transcript_encrypted, transcript_iv = encrypt_data(transcript)` on line 98, but **omits both fields** from the `record` dict inserted into `call_records` on lines 113–128. Also missing `@router.post("/")` decorator needed when `redirect_slashes=False`. | Add `"transcript_encrypted": transcript_encrypted, "transcript_iv": transcript_iv` to `record`, and add `@router.post("/")` alongside `@router.post("")`. |
| `services/vault_scanner_service.py` | 128–141 | Calls `wav_path = process_audio_ingest(...)` and `run_transcription(wav_path)` without calling `cleanup_processed_audio(wav_path)` in a `finally:` block, leaking temporary `.wav` files in `audio_ingest/temp/`. | Wrap step 3 in `try: ... finally: cleanup_processed_audio(wav_path)`. |
| `core/auditor.py` | 75 | Checks `os.environ.get("GEMINI_API_KEY")`, whereas `ai_briefing_service.py` and `routers/system.py` use `GOOGLE_API_KEY`. | Check `os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")`. |
| `diagnostic_check.py` & `list_models.py` | 4, 2 | Both still import `google.generativeai as genai` (deprecated v1 SDK removed from `requirements.txt` in favor of `google-genai>=1.16.0`). | Update both scripts to use `from google import genai`. |

---

## Section 4: Recommended Consolidation Action Plan (Priority Order)

1. **Restore `horizon_supervisor.py` and `ingestion_server.py` to `mcp-backend/`** (or fix `BACKEND_DIR` / `sys.path` in `scripts/` and `scripts/start.ps1`) so the supervised dual-server pipeline (`port 8000` API + `port 9000` Ingestion) boots cleanly out of the box.
2. **Add `000_initial_schema.sql` (from `schema.sql`) to `mcp-backend/migrations/`**, fix the `organizations` -> `contacts` creation order, and reconcile the `entities` table collision between `000_initial_schema.sql` (REQ-018 field provenance) and `001_actions_and_entities.sql` (Item 13 entity graph).
3. **Merge `Imports_legitk1ng` Pearls into `Desktop_horizon/mcp-backend/`**:
   - `services/acr_parser_reference.py` & `utils/naming.py`: Combine Pattern T, Pattern Z, `slugify()` ASCII stripping, and FB time-fragment guard (`Imports_legitk1ng`) with Pattern H2 (`Desktop_horizon`).
   - `routers/transcriptions.py` & `services/transcription_service.py`: Move `horizon_meta` to `X-Horizon-*` headers, restore `Date` Unix-ms/sec -> ISO-8601 normalization, add `@router.post("/audio/transcriptions")`, and add `or` primitive guards on Whisper segment fields so ACR Phone's Kotlin SDK never crashes.
   - `routers/batch_ingest.py`: Merge `POST /api/v1/batch-ingest/transcribe`, `POST /api/v1/batch-ingest/resolve-stubs`, and live DB status counts from `Imports_legitk1ng` with `Desktop_horizon`'s WiFi sync (`source="wifi"`) and `/probe` endpoints.
   - `routers/data.py`: Port `GET /api/v1/data/quality` and `_count` / `_sql_avg_health` helpers from `Imports_legitk1ng`.
   - `core/api_key_auth.py`: Restore `Secret: Optional[str] = Form(None)` fallback from `Imports_legitk1ng`.
   - `core/security/crypto.py`: Restore `_derived_key` caching from `Imports_legitk1ng`.
   - `services/enrichment_service.py`: Restore `coro_factory` retry lambdas and `https://apilayer.net` from `Imports_legitk1ng`, and fix `_get_model()` -> `_generate()`.
   - `services/audio_processing_service.py`: Combine `_extract_ffmpeg_error` (`Desktop_horizon`) with Windows `PermissionError` (`WinError 32`) retry loops (`Imports_legitk1ng`).
   - `services/google_people_service.py`: Restore `invalid_grant` SSE broadcast (`system:auth_required`) from `Imports_legitk1ng`.
4. **Copy All 14 Unique Scripts/Tests/Tools into Their Consolidated Locations**:
   - `MyDrive_77Horizon_Tools/acr_scanner.py` -> `scripts/acr_scanner.py`
   - `MyDrive_77Horizon_Tools/horizon_consolidate_v2.py` (+ Pattern H2) -> `scripts/horizon_consolidate_v2.py`
   - `KB/build_kb.py` & `KB/query.py` -> `scripts/kb/build_kb.py` & `scripts/kb/query.py`
   - `Imports_legitk1ng/scripts/extract_kanban.py` -> `scripts/extract_kanban.py`
   - `Desktop_unsorted/auto_link.py` -> `scripts/tools/auto_link.py`
   - `Imports_Surface3_WP/mcp-backend/test_handshake.py` & `test_schema.py` -> `mcp-backend/tests/`
   - `Imports_Surface3_WP/scripts/*.ps1` -> `scripts/gateway/`
   - `Imports_Surface3_WP/scripts/test_connect.js` -> `scripts/diagnostics/test_connect.js`
   - `Eclipse_unsorted/_reorg_purge.py` & `_reorg_purge2.py` -> `scripts/maintenance/`
