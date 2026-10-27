# Horizon PRM — Constitution Patches (merged)

> Consolidated from `CONSTITUTION_PATCH.md` and `TECHNICAL_CORRECTIONS.md`. Applies to the Engineering Constitution (`docs/CONSTITUTION.md`).

---

## Part A — Constitution Technical Corrections (was CONSTITUTION_PATCH.md)

# Horizon PRM — Constitution Technical Corrections
**Version:** 1.0  
**Applies to:** CONSTITUTION.pdf v3.0 — Sections 3, 7, 13, 16, 17  
**Status:** Authoritative patch document. Each correction below closes a known issue.  
**Last Updated:** 2026-06-13  
**Maintained by:** Brandon

---

## How to Use This Document

Work top to bottom. Each section is a self-contained correction:
- **File** — exact path from the project root
- **Problem** — what's broken and why
- **Fix** — production-ready replacement code
- **Verification** — how to confirm the fix worked

Do not apply fixes out of order within a priority tier. Priority 1 items affect runtime stability and must land before any production use.

---

## Priority 1 — Production Safety

These two issues cause active harm on every run. Fix before anything else.

---

### P1-A: Supervisor Unconditionally Passes `--reload` in Production
**Issue ID:** C6  
**File:** `mcp-backend/horizon_supervisor.py`  
**Severity:** High — activates inotify/FSEvents file watcher in production, unnecessary CPU overhead on Z2G3

**Problem:**  
`horizon_supervisor.py` currently builds the uvicorn launch command unconditionally with `--reload --reload-dir`. The file watcher fires on every write to the backend directory — log flushes, temp files, transcript output — creating a constant background load on the Z2G3's CPU that serves no purpose outside development.

**Fix:**

Add a single environment variable check. Existing launch logic stays intact; only the flag inclusion changes.

```python
# horizon_supervisor.py
# ── Add near the top, after existing imports ──────────────────────────────

import os

# Set PRODUCTION=1 in the Windows Task Scheduler "Environment variables" field
# or in a .env.production file loaded before the supervisor starts.
# When unset, defaults to development mode (--reload active).
_PRODUCTION = os.environ.get("PRODUCTION", "").strip().lower() in ("1", "true", "yes")


# ── Replace the uvicorn launch command builder ────────────────────────────
# BEFORE (existing):
#   cmd = [
#       sys.executable, "-m", "uvicorn",
#       module,
#       "--host", "0.0.0.0",
#       "--port", str(port),
#       "--reload",
#       "--reload-dir", str(BACKEND_DIR),
#   ]
#
# AFTER:
def _build_uvicorn_cmd(module: str, port: int) -> list[str]:
    """Build the uvicorn launch command.
    
    In production (PRODUCTION=1), --reload is omitted to avoid
    unnecessary inotify/FSEvents overhead on the Z2G3 workstation.
    """
    cmd = [
        sys.executable, "-m", "uvicorn",
        module,
        "--host", "0.0.0.0",
        "--port", str(port),
    ]
    if not _PRODUCTION:
        cmd += ["--reload", "--reload-dir", str(BACKEND_DIR)]
    return cmd
```

Anywhere the uvicorn command is currently built inline, replace with `_build_uvicorn_cmd(module, port)`.

**Verification:**
```bash
# Development (default) — should show --reload in process list
PRODUCTION=0 python horizon_supervisor.py &
ps aux | grep uvicorn  # Expect: --reload --reload-dir present

# Production
PRODUCTION=1 python horizon_supervisor.py &
ps aux | grep uvicorn  # Expect: no --reload flag
```

**Constitution Update Required:**  
Constitution §3 "Uvicorn Launch Flags" table — update the `--reload` row to note it is conditional on `PRODUCTION` env var. Remove the C6 entry from §22 Known Issues.

---

### P1-B: Source Maps Enabled in Production APK Builds
**Issue ID:** C10  
**File:** `vite.config.ts`  
**Severity:** High — exposes full source structure in production APK, privacy/security risk for a personal intelligence platform

**Problem:**  
`vite.config.ts` has `sourcemap: true` as a hardcoded build option. This means the production APK and every `npm run build` output ships with source maps that reconstruct the original TypeScript source. For a platform storing encrypted call transcripts and OSINT-enriched contact data, this is an unnecessary exposure surface.

**Fix:**

```typescript
// vite.config.ts
// BEFORE:
// build: {
//   sourcemap: true,
//   ...
// }

// AFTER:
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const isProduction = mode === 'production'

  return {
    // ... existing config ...
    build: {
      // Source maps: enabled in dev/staging for debugging, disabled in production
      // to prevent source reconstruction from APK extraction.
      // Override with VITE_SOURCEMAP=true for a one-off production debug build.
      sourcemap: env.VITE_SOURCEMAP === 'true' ? true : !isProduction,

      // Existing manual chunks — keep as-is
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'charts': ['recharts', 'd3'],
            'icons': ['lucide-react'],
          },
        },
      },
    },
  }
})
```

**Verification:**
```bash
# Production build — no .map files should appear in dist/
npm run build
find dist/ -name "*.map"  # Should return nothing

# Development build — maps present
npm run dev  # Sourcemaps active in browser devtools as expected
```

**Constitution Update Required:**  
Constitution §17 "Frontend (.env.local)" table — add `VITE_SOURCEMAP` as an optional override variable. Remove C10 from §22.

---

## Priority 2 — Architecture Integrity

These items create tight coupling or missing safety nets that will cause non-obvious failures as the codebase grows.

---

### P2-A: `_run_transcription()` Belongs in TranscriptionManager, Not the Router
**Issue ID:** C9  
**Files:** `mcp-backend/routers/transcriptions.py`, `mcp-backend/services/transcription_service.py`, `mcp-backend/core/sentinel.py`  
**Severity:** Medium-High — tight coupling between router layer and Sentinel daemon; router refactor silently breaks transcription retry

**Problem:**  
`HorizonSentinel` currently imports and calls `_run_transcription()` from `routers/transcriptions.py` — a module-level function in the HTTP router layer. This means:
1. The Sentinel has a hard import dependency on a router module
2. If the router is renamed, split, or refactored, the Sentinel silently breaks
3. `_run_transcription()` logic is impossible to unit test without importing HTTP machinery
4. The TranscriptionManager singleton exists precisely to own this logic

**Fix — Phase 1: Move the function**

```python
# services/transcription_service.py
# Add this method to the TranscriptionManager class

class TranscriptionManager:
    """Singleton. Whisper and Pyannote models are loaded once on first call.
    Both models are held in RAM to prevent per-call load overhead.
    """
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def initialize(self) -> None:
        """Called once at ingestion server startup. Loads models into RAM."""
        if self._initialized:
            return
        # ... existing model initialization logic ...
        self._initialized = True

    async def run_transcription(
        self,
        audio_path: str,
        call_id: str,
        metadata: dict,
        db_client=None,
    ) -> dict:
        """
        Execute the full transcription pipeline for a single audio file.
        
        This is the canonical entry point for transcription. Called by:
          - routers/transcriptions.py (webhook ingest path)
          - core/sentinel.py (retry/self-healing path)
        
        Args:
            audio_path: Absolute path to the audio file on disk.
            call_id: Supabase call_records UUID for status updates.
            metadata: Dict with direction, phone_number, contact_name, timestamp.
            db_client: Optional Supabase client override (for testing).
        
        Returns:
            Dict with keys: transcript, diarized_segments, executive_brief,
            sentiment, action_items, tags, category.
        
        Raises:
            TranscriptionError: If Whisper or Pyannote fails after internal retry.
            EncryptionError: If FIELD_ENCRYPTION_MASTER_KEY is unavailable.
        """
        # Move the body of _run_transcription() from routers/transcriptions.py here.
        # No logic changes — only relocating the function to the correct owner.
        ...
```

**Fix — Phase 2: Update the router to delegate**

```python
# routers/transcriptions.py
# BEFORE: defines _run_transcription() at module level
# AFTER: delegates to TranscriptionManager

from services.transcription_service import TranscriptionManager

transcription_manager = TranscriptionManager()


# Keep the FastAPI endpoint handler, remove the function body:
async def _handle_transcription_background(
    audio_path: str,
    call_id: str,
    metadata: dict,
) -> None:
    """BackgroundTask wrapper — delegates to TranscriptionManager."""
    await transcription_manager.run_transcription(
        audio_path=audio_path,
        call_id=call_id,
        metadata=metadata,
    )
```

**Fix — Phase 3: Update Sentinel to use the manager**

```python
# core/sentinel.py
# BEFORE:
# from routers.transcriptions import _run_transcription
# await _run_transcription(audio_path, call_id, metadata)

# AFTER:
from services.transcription_service import TranscriptionManager

_transcription_manager = TranscriptionManager()  # Same singleton instance

# In the retry logic:
await _transcription_manager.run_transcription(
    audio_path=audio_path,
    call_id=call_id,
    metadata=metadata,
)
```

**Verification:**
```bash
# Sentinel import check — no longer depends on the router layer
python -c "from core.sentinel import HorizonSentinel; print('OK')"
# Should not print any warning about routers.transcriptions

# Transcription manager is the same singleton across both paths
python -c "
from services.transcription_service import TranscriptionManager
from core.sentinel import _transcription_manager as s_mgr
from routers.transcriptions import transcription_manager as r_mgr
assert s_mgr is r_mgr, 'Singleton violated — different instances'
print('Singleton verified')
"
```

**Constitution Update Required:**  
Constitution §7 "Transcription & Diarization Pipeline" — update the `_run_transcription() Coupling` subsection from "known issue" to document the resolved architecture. Remove C9 from §22.

---

### P2-B: Encryption Key Verification at Startup
**Issue ID:** New (not in C1–C10)  
**File:** `mcp-backend/ingestion_server.py` (startup sequence), new `mcp-backend/core/security/verify.py`  
**Severity:** Medium-High — if `FIELD_ENCRYPTION_MASTER_KEY` is wrong or missing, transcripts write silently as corrupted data with no recovery path

**Problem:**  
The ingestion server starts and accepts webhook payloads without verifying that `FIELD_ENCRYPTION_MASTER_KEY` can actually encrypt and decrypt. A misconfigured, rotated, or missing key causes every incoming call to write unrecoverable ciphertext to Supabase. There is no runtime warning until a read attempt fails.

**Fix — Create `core/security/verify.py`:**

```python
# mcp-backend/core/security/verify.py
"""
Encryption key verification utilities.
Called at ingestion server startup before any webhook is accepted.
"""

import os
import logging

from .crypto import encrypt_data, decrypt_data

logger = logging.getLogger(__name__)

_PROBE_PLAINTEXT = "horizon_encryption_key_probe_v1"


def verify_field_encryption_key() -> None:
    """
    Verify that FIELD_ENCRYPTION_MASTER_KEY is set and functional.
    
    Performs a round-trip encrypt/decrypt of a known probe string.
    Raises RuntimeError on failure — this should halt server startup.
    
    Call this once during ingestion_server.py lifespan startup,
    BEFORE registering any routes or accepting connections.
    """
    key = os.environ.get("FIELD_ENCRYPTION_MASTER_KEY")

    if not key:
        raise RuntimeError(
            "FIELD_ENCRYPTION_MASTER_KEY is not set. "
            "The ingestion server cannot safely store transcripts. "
            "Generate a key with: "
            "python -c \"import secrets; print(secrets.token_urlsafe(32))\""
        )

    try:
        ciphertext_b64, iv_b64 = encrypt_data(_PROBE_PLAINTEXT)
        decrypted = decrypt_data(ciphertext_b64, iv_b64)
    except Exception as exc:
        raise RuntimeError(
            f"FIELD_ENCRYPTION_MASTER_KEY verification failed during encrypt/decrypt: {exc}. "
            "The key may be malformed, truncated, or corrupted. "
            "Do NOT start the ingestion server — transcripts cannot be safely stored."
        ) from exc

    if decrypted != _PROBE_PLAINTEXT:
        raise RuntimeError(
            "FIELD_ENCRYPTION_MASTER_KEY round-trip produced incorrect output. "
            "Encryption appears to be non-deterministic or the key is corrupted. "
            "Halt immediately."
        )

    logger.info("✓ FIELD_ENCRYPTION_MASTER_KEY verified — encryption operational.")
```

**Fix — Add to ingestion server startup sequence:**

```python
# mcp-backend/ingestion_server.py
# Add to the startup sequence documented in Constitution §4
# Position: Step 1.5 — after .env null-byte stripping, before init_supabase()

from core.security.verify import verify_field_encryption_key

# Startup Sequence (updated):
# 1. Strip null bytes from .env (corruption guard)         ← existing
# 1.5 verify_field_encryption_key()                        ← NEW — halts if broken
# 2. init_supabase()                                       ← existing
# 3. asyncio.create_task(sentinel.run())                   ← existing
# 4. Log HORIZON_API_KEY prefix                            ← existing

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Pre-startup verification — must run before routes are live
    verify_field_encryption_key()  # Raises RuntimeError on failure; halts startup
    
    await init_supabase()
    asyncio.create_task(sentinel.run())
    logger.info("Ingestion server ready.")
    yield
    # Shutdown logic here if needed
```

**Verification:**
```bash
# Test with missing key
FIELD_ENCRYPTION_MASTER_KEY="" python -c "
from core.security.verify import verify_field_encryption_key
try:
    verify_field_encryption_key()
    print('FAIL — should have raised')
except RuntimeError as e:
    print(f'PASS — caught: {e}')
"

# Test with valid key
FIELD_ENCRYPTION_MASTER_KEY="$(python -c 'import secrets; print(secrets.token_urlsafe(32))')" \
python -c "
from core.security.verify import verify_field_encryption_key
verify_field_encryption_key()
print('PASS — key verified')
"
```

**Constitution Update Required:**  
Constitution §4 "Startup Sequence" — add Step 1.5 as documented above. Constitution §8 "Transcript Encryption" — add a note: "Key verification runs at ingestion server startup via `core/security/verify.py`. Server will not start if the key is absent or non-functional."

---

## Priority 3 — GPU Pipeline Formalization

This constraint exists in KNOWLEDGE2.md but not in the Constitution. Any developer (or AI assistant) working from the Constitution alone will miss it and crash the Z2G3.

---

### P3-A: Codify Serial GPU Task Queue in Constitution §7
**Issue ID:** New (gap in CONSTITUTION.pdf §7)  
**File:** `CONSTITUTION.pdf` (documentation only — no code change required)  
**Severity:** Medium — missing constraint causes immediate hardware failure when violated

**Problem:**  
The HP Z2G3 Mini houses a Quadro M620 with 2GB VRAM. Pyannote 3.1 and Faster-Whisper cannot run concurrently on the GPU — the combined VRAM footprint exceeds the ceiling. The correct pattern (serial execution: diarize → unload → transcribe) exists in KNOWLEDGE2.md but is absent from the Constitution's §7 transcription section, which is the document developers read.

**Fix — Add subsection to Constitution §7:**

```markdown
## 7. Transcription & Diarization Pipeline

[... existing content ...]

### GPU Serial Task Queue — Hardware Constraint (Z2G3 Quadro M620)

**This constraint is non-negotiable on the primary workstation (hp-z2g3-mini-workstation).**

The Quadro M620 has 2GB VRAM. Pyannote 3.1 and Faster-Whisper together exceed this ceiling
if run simultaneously. The pipeline enforces a strict serial execution pattern:

```
Step 1: Load Pyannote pipeline → run diarization → unload model → clear GPU cache
Step 2: Load Whisper model     → run transcription → (keep resident as singleton)
```

**Implementation in `services/transcription_service.py`:**

```python
# After diarization completes:
diarize_pipeline = Pipeline.from_pretrained(
    "pyannote/speaker-diarization-3.1",
    use_auth_token=HUGGINGFACE_TOKEN,
).to(torch.device(DEVICE))

diarization = diarize_pipeline(audio_path)

# CRITICAL: Unload before loading Whisper
del diarize_pipeline
if DEVICE == "cuda":
    torch.cuda.empty_cache()

# Now safe to load/use Whisper
whisper_model = TranscriptionManager()._whisper  # Singleton — already loaded if warm
```

**CPU Fallback:**
If GPU OOM occurs during diarization despite the serial pattern (e.g., a second concurrent
call arrives during processing), the Pyannote pipeline should fall back gracefully:

```python
try:
    diarize_pipeline = diarize_pipeline.to(torch.device("cuda"))
except RuntimeError:
    # VRAM full — degrade gracefully to CPU
    logger.warning("GPU OOM during diarization — falling back to CPU.")
    diarize_pipeline = diarize_pipeline.to(torch.device("cpu"))
```

Diarization on CPU is slower (~3–4x) but correct. Whisper inference stays on GPU.

**Whisper Singleton Exception:**
The Whisper model is kept resident in RAM as a singleton (see TranscriptionManager).
This is intentional — it avoids the ~8–12 second model load penalty per call.
Only Pyannote is loaded/unloaded per transcription.
```

**Constitution Update Required:**  
Add the above as a new subsection in §7 between "Faster-Whisper" and "Pyannote Speaker Diarization." No code change required.

---

## Priority 4 — Build & Code Hygiene

Lower risk, but they ship dead weight and create naming confusion.

---

### P4-A: Remove Dead Production Dependencies
**Issue IDs:** C4 (`socket.io-client`), C7 (`@google/clasp`)  
**File:** `package.json`  
**Severity:** Low-Medium — bloated APK bundle; `@google/clasp` ships a CLI tool in production builds

**Fix:**

```json
// package.json — changes:

// 1. REMOVE from "dependencies" entirely:
//    "socket.io-client": "^4.8.3"
//    Reason: No Socket.IO server exists in the stack. This is a dead 4MB+ dependency.
//    The socket.io-client entry in src/ (if any) should be replaced with Supabase Realtime.

// 2. MOVE from "dependencies" to "devDependencies":
//    "@google/clasp": "^3.2.0"
//    Reason: Google Apps Script CLI — a developer tool with no runtime role.

// Resulting devDependencies additions:
{
  "devDependencies": {
    "@google/clasp": "^3.2.0",   // moved from dependencies
    // ... existing devDependencies ...
  }
}

// Resulting dependencies removals:
// Remove: "socket.io-client": "^4.8.3"
// Remove: "@google/clasp": "^3.2.0"  (now in devDependencies)
```

**Verification:**
```bash
# After change:
npm install
npm run build

# Confirm socket.io-client is not in the production bundle
grep -r "socket.io" dist/  # Should return nothing meaningful

# Confirm clasp is available in dev but not bundled
npx clasp --version  # Should work in dev
```

**Note on socket.io-client removal:**  
Before removing, search the codebase for any `import` or `require` referencing `socket.io-client`:

```bash
grep -r "socket.io-client" src/
```

If found, each import must be replaced with the Supabase Realtime equivalent before removing the dependency. If no imports exist, the removal is safe.

---

### P4-B: Rename `startAutonomousMissions()` — Clarity on Cosmetic vs. Real
**Issue ID:** C8  
**File:** `src/services/GuardianService.ts`  
**Severity:** Low — naming creates false expectation; real health data and simulated activity data are indistinguishable in the codebase

**Problem:**  
`startAutonomousMissions()` generates randomized UI animation events every 30 seconds with no real backend calls. The name implies autonomous AI action. Any developer reading `GuardianService.ts` for the first time has no way to know this loop is cosmetic unless they read the Constitution.

**Fix:**

```typescript
// src/services/GuardianService.ts

/**
 * COSMETIC SIMULATION — generates randomized UI animation events for the
 * Guardian agent panel cards. Does NOT perform real AI operations, backend
 * calls, or any meaningful computation.
 *
 * Real system health is provided by startHealthCheck() which calls
 * /api/v1/health on a 60-second interval.
 *
 * Do NOT add real backend calls to this loop. Keep it pure UI animation.
 * See CONSTITUTION.pdf §13 (Guardian System) for full context.
 */
startMissionSimulation(): void {
  // Body unchanged — only the name and JSDoc are updated
  this._missionInterval = setInterval(() => {
    // ... existing randomized event generation logic ...
  }, 30_000);
}

// Update all call sites:
// BEFORE: this.startAutonomousMissions()
// AFTER:  this.startMissionSimulation()
```

**Search for all call sites:**
```bash
grep -r "startAutonomousMissions" src/
# Update each occurrence to startMissionSimulation()
```

**Additional: Visual differentiation in SystemBots.tsx**

The agent cards that display simulated mission events should be visually distinct from the Sentinel status panel which shows real data. Add a subtle indicator:

```tsx
// src/components/SystemBots.tsx
// On each agent card that runs simulated missions, add:

<span className="hzn-pill hzn-pill-accent" style={{ opacity: 0.6 }}>
  simulated
</span>

// Or alternatively, render the agent activity area with:
// border-style: dashed (vs. solid for real health indicators)
// This gives a visual cue without being distracting
```

---

## Known Issues Status Ledger

Complete tracking of all C1–C10 items from Constitution v3.0.

| ID | Issue | Status After This Document | File |
|---|---|---|---|
| C1 | `auditor.py` stale `OPENAI_API_KEY` reference | ✅ Fixed in v3.0 | `core/auditor.py` |
| C2 | `HUGGINGFACE_TOKEN` missing from `.env.example` | ✅ Fixed in v3.0 | `.env.example` |
| C3 | `FIELD_ENCRYPTION_MASTER_KEY` missing from `.env.example` | ✅ Fixed in v3.0 | `.env.example` |
| C4 | `socket.io-client` dead production dependency | 🔧 Fix in P4-A above | `package.json` |
| C5 | `VITE_BACKEND_URL_MOBILE` wiring | ✅ Already correct (v3.0) | `src/services/apiClient.ts` |
| C6 | Supervisor passes `--reload` in production | 🔧 Fix in P1-A above | `horizon_supervisor.py` |
| C7 | `@google/clasp` in production dependencies | 🔧 Fix in P4-A above | `package.json` |
| C8 | `startAutonomousMissions()` naming misleads | 🔧 Fix in P4-B above | `GuardianService.ts` |
| C9 | `_run_transcription()` router coupling | 🔧 Fix in P2-A above | `routers/transcriptions.py` |
| C10 | `sourcemap: true` in production Vite build | 🔧 Fix in P1-B above | `vite.config.ts` |
| NEW | Encryption key not verified at startup | 🔧 Fix in P2-B above | `ingestion_server.py` |
| NEW | GPU serial task queue undocumented | 🔧 Fix in P3-A above | `CONSTITUTION.pdf §7` |

**Legend:** ✅ Already resolved | 🔧 Fix provided in this document

---

## Applying These Changes

**Recommended order:**

```
1. vite.config.ts              (P1-B) — one-liner, zero risk
2. horizon_supervisor.py       (P1-A) — add PRODUCTION check
3. core/security/verify.py     (P2-B) — new file, then wire into ingestion_server.py
4. package.json                (P4-A) — remove/move dependencies, run npm install
5. GuardianService.ts          (P4-B) — rename + JSDoc
6. transcription_service.py    (P2-A) — move _run_transcription(), update imports
7. Constitution documentation  (P3-A) — add GPU constraint to §7
```

After all changes:
```bash
# Full verification pass
npm run build               # No map files in dist/
python -m pytest tests/     # All existing tests pass
curl localhost:9000/v1/health  # Ingestion server starts cleanly
```

---

*End of CONSTITUTION_PATCH.md*  
*Once all items in the ledger show ✅, this document is complete. Archive it in `docs/` for audit trail.*

---

## Part B — Technical Corrections (was TECHNICAL_CORRECTIONS.md)

# Horizon PRM — Technical Corrections v1.0
**Type:** Executable Patch Document  
**Addresses:** Constitution §22 Known Issues C4, C6, C7, C8, C9, C10 + two undocumented gaps  
**Status:** All patches pending application  
**Updated:** 2026-06-13

---

## Patch Index

| ID | Item | File | Priority | Effort |
|---|---|---|---|---|
| PATCH-01 | C6 — Conditional `--reload` in production | `horizon_supervisor.py` | 🔴 Critical | ~15 min |
| PATCH-02 | C10 — Sourcemap exposure in APK | `vite.config.ts` | 🔴 Critical | ~2 min |
| PATCH-03 | C4/C7 — Dead production dependencies | `package.json` | 🟡 High | ~5 min |
| PATCH-04 | C8 — GuardianService cosmetic loop | `GuardianService.ts` | 🟡 High | ~10 min |
| PATCH-05 | C9 — Sentinel/router decoupling | `transcriptions.py` + `TranscriptionManager` | 🟠 Medium | ~45 min |
| PATCH-06 | Undocumented — GPU serial task queue | `CONSTITUTION.pdf §7` | 🟡 High | ~10 min (doc) |
| PATCH-07 | Undocumented — Encryption key verifier | `mcp-backend/core/verify_key.py` | 🔴 Critical | ~20 min |
| PATCH-08 | Constitution §22 status update | `CONSTITUTION.pdf §22` | 🟢 Low | ~5 min |

---

## PATCH-01 — C6: Conditional `--reload` in Production

### Problem
`horizon_supervisor.py` unconditionally passes `--reload --reload-dir` to every uvicorn process it spawns. On the HP Z2G3, this activates inotify file watchers on the entire `mcp-backend/` directory tree in production, creating continuous CPU overhead even when no files are changing. On a Python virtualenv with hundreds of packages, the watcher registers thousands of inode monitors.

### File
`C:\Users\owner\OneDrive\Desktop\horizon\mcp-backend\horizon_supervisor.py`

### Change

Find the section that builds the uvicorn launch command. Based on Constitution §3, it currently constructs:

```python
# CURRENT — always passes --reload (BROKEN in production)
cmd = [
    sys.executable, "-m", "uvicorn",
    module,
    "--host", "0.0.0.0",
    "--port", str(port),
    "--reload",
    "--reload-dir", str(BACKEND_DIR),
]
```

Replace with:

```python
# PATCHED — conditionally passes --reload based on PRODUCTION env var
import os

# Read once at module load, not per-process-launch
_PRODUCTION = os.getenv("PRODUCTION", "").strip().lower() in ("1", "true", "yes")

# In the function/method that builds the launch command:
cmd = [
    sys.executable, "-m", "uvicorn",
    module,
    "--host", "0.0.0.0",
    "--port", str(port),
]

if not _PRODUCTION:
    cmd.extend(["--reload", "--reload-dir", str(BACKEND_DIR)])
```

Also add to the supervisor's startup log so the mode is always visible:

```python
# In the supervisor's startup banner / init block:
logger.info(
    f"HorizonSupervisor starting — mode: {'PRODUCTION' if _PRODUCTION else 'DEVELOPMENT'} "
    f"| reload: {'disabled' if _PRODUCTION else 'enabled'}"
)
```

### Activation

Add `PRODUCTION=1` to the Windows Task Scheduler task arguments when running live, **or** set it in the environment before running `start.ps1` for production mode:

```powershell
# In start.ps1, add before launching supervisor:
$env:PRODUCTION = "1"
```

For development, omit the variable entirely — the default is development mode (reload enabled).

### Verify
After applying: start the supervisor with `PRODUCTION=1` set. Check `mcp-backend/logs/supervisor.log` — the startup line should read `mode: PRODUCTION | reload: disabled`. Confirm the uvicorn processes do not have `--reload` in their command lines via:

```powershell
Get-Process python | Select-Object -Property Id, CommandLine
# or via Task Manager → Details tab
```

### Constitution Update Required
§3 `horizon_supervisor.py` section, Uvicorn Launch Flags table — update the flags row and remove the Known Issue note for C6 from §22.

---

## PATCH-02 — C10: Sourcemap Exposure in Production Vite Build

### Problem
`vite.config.ts` has `sourcemap: true` hardcoded. Production APK bundles include full source maps, exposing the React component tree, file structure, and logic to anyone who extracts the APK with `apktool` or opens DevTools on a connected device. For a private intelligence platform, this is a meaningful exposure.

### File
`C:\Users\owner\OneDrive\Desktop\horizon\vite.config.ts`

### Change

Find the `build` block in `vite.config.ts`:

```typescript
// CURRENT
build: {
  sourcemap: true,
  // ...
}
```

Replace with:

```typescript
// PATCHED
build: {
  sourcemap: process.env.NODE_ENV !== 'production',
  // ...
}
```

This keeps sourcemaps on during `npm run dev` (where `NODE_ENV` is `development`) and disables them for `npm run build` (where Vite sets `NODE_ENV=production` automatically).

### Verify

```bash
npm run build
# Then inspect the dist/ directory:
ls dist/assets/*.js.map
# Should return: no files found (no .map files generated)
```

For development confirm maps are still present:
```bash
# During dev server:
# Open browser DevTools → Sources → should show original .tsx files
```

### Constitution Update Required
§12 Vite Configuration table — update sourcemap row from `true` to `process.env.NODE_ENV !== 'production'`. Remove C10 from §22 open issues.

---

## PATCH-03 — C4/C7: Dead Production Dependencies

### Problem
Two packages are listed in `dependencies` (shipped in production builds and APKs) that have no runtime role:

- `socket.io-client@4.8.3` — ~4MB. No Socket.IO server exists in the stack. Referenced nowhere in active code.
- `@google/clasp@3.2.0` — Google Apps Script CLI tool. Developer-only. Has no place in a browser/Capacitor bundle.

Both inflate the production bundle and APK size unnecessarily.

### File
`C:\Users\owner\OneDrive\Desktop\horizon\package.json`

### Change

**Step 1:** Verify neither package is imported anywhere in `src/`:

```bash
# Run from project root:
grep -r "socket.io-client" src/
grep -r "@google/clasp" src/
# Both should return zero results.
# If socket.io-client shows any imports, investigate before removing.
```

**Step 2:** Move to `devDependencies`:

```bash
npm uninstall socket.io-client @google/clasp
npm install --save-dev socket.io-client @google/clasp
```

Or, if `socket.io-client` shows no imports anywhere, remove it entirely:

```bash
npm uninstall socket.io-client
npm install --save-dev @google/clasp
```

**Resulting `package.json` diff (dependencies block):**
```json
// REMOVE from "dependencies":
"socket.io-client": "^4.8.3",
"@google/clasp": "^3.2.0",

// ADD to "devDependencies":
"@google/clasp": "^3.2.0",
// socket.io-client: only add to devDependencies if grep found uses in test files
```

### Verify

```bash
npm run build
# Check bundle size reduction in dist/assets/ — expect measurable reduction
npx cap sync android
./android/gradlew assembleRelease
# APK should be smaller. Verify no build errors.
```

### Note on `socket.io-client`
The `engine.io-client` dependency (which `socket.io-client` brings in) also pulls `ws` and `xmlhttprequest-ssl`. Removing it from production will reduce the bundle by approximately 4.2MB uncompressed. Worth confirming the APK build succeeds cleanly before marking resolved.

### Constitution Update Required
§17 `package.json` notes — remove C4 and C7 from §22 open issues after confirmed resolution.

---

## PATCH-04 — C8: GuardianService Cosmetic Loop Clarity

### Problem
`startAutonomousMissions()` in `GuardianService.ts` generates randomized UI animation events every 30 seconds with **zero real backend calls**. The function name implies real AI agent operations, creating a false impression about what the system is doing. Any future developer reading this code will assume it performs real work. More critically, it borrows the brand identity of the four named agents (AEGIS-01, PATHFINDER-04, NEXUS-FIXER, LUMINA-AI) and applies it to simulated activity — eroding trust in the Guardian UI as a source of real system state.

### File
`src/services/GuardianService.ts` (exact path may vary — search for `startAutonomousMissions`)

### Change

**Rename the method and add a mandatory warning comment:**

```typescript
// ─── BEFORE ──────────────────────────────────────────────────────────────
startAutonomousMissions(): void {
  this.missionInterval = setInterval(() => {
    // generates randomized UI events
  }, 30_000);
}


// ─── AFTER ───────────────────────────────────────────────────────────────

/**
 * ⚠️ COSMETIC_ONLY — startMissionSimulation
 *
 * This function generates randomized UI animation events for the Guardian agent
 * panel. It does NOT perform any real AI operations, backend calls, database
 * writes, or health assessments. All "missions" displayed are fabricated for
 * visual effect.
 *
 * Real system health is reported ONLY by:
 *   - startHealthCheck()       → calls /api/v1/health (real)
 *   - HorizonSentinel daemon   → self-healing pipeline (real)
 *   - SystemStatusBar.tsx      → NETWORK/SUPABASE/LATENCY metrics (real)
 *
 * Do not add real backend calls to this function. Keep it cosmetic.
 * See Constitution §13 — Guardian System.
 */
startMissionSimulation(): void {  // renamed from startAutonomousMissions
  this.missionInterval = setInterval(() => {
    // generates randomized UI animation events — cosmetic only
  }, 30_000);
}
```

**Update the call site(s).** Search for `startAutonomousMissions` across the entire codebase and rename each call:

```bash
grep -r "startAutonomousMissions" src/
# Update each call site to: startMissionSimulation()
```

**Update the Guardian agent card UI** to visually distinguish cosmetic activity from real health:

In the component rendering agent mission events (likely `SystemBots.tsx`), add a visual indicator to cosmetic event cards:

```typescript
// In the agent activity event renderer, cosmetic events should render with:
// - Muted text color (--ink-3 not --ink)
// - No accent border
// - A small "sim" or "~" prefix on the activity label
// - Explicitly NOT the ochre accent glow used by real alerts

// Example label transform:
const displayLabel = event.isCosmeticOnly
  ? `~ ${event.label}`
  : event.label;

const cardClass = event.isCosmeticOnly
  ? 'hzn-guardian-event hzn-guardian-event--sim'
  : 'hzn-guardian-event hzn-guardian-event--real';
```

Add the CSS:
```css
.hzn-guardian-event--sim {
  color: var(--ink-3);
  border-color: var(--border-subtle);
  opacity: 0.75;
}
.hzn-guardian-event--real {
  color: var(--ink);
  border-color: var(--border-accent);
}
```

### Verify
- Build succeeds with no TypeScript errors referencing the old method name.
- Guardian panel still animates correctly.
- `startHealthCheck()` (the real health loop) is unaffected.

### Constitution Update Required
§13 Guardian System — update `startAutonomousMissions()` references to `startMissionSimulation()`. Remove C8 from §22 open issues.

---

## PATCH-05 — C9: Sentinel/Router Decoupling

### Problem
`HorizonSentinel` (daemon in `mcp-backend/core/sentinel.py`) calls `_run_transcription()` — a module-level function exported from `mcp-backend/routers/transcriptions.py`. This creates tight coupling: the daemon layer directly depends on the router layer. If the router is ever renamed, split, or restructured, the Sentinel silently breaks. The daemon should only depend on the service layer, never the router layer.

### Current Architecture (broken coupling)
```
sentinel.py          →  routers/transcriptions.py
(daemon/core layer)     (HTTP router layer)
                        └── _run_transcription()  ← wrong layer for shared logic
```

### Target Architecture
```
sentinel.py          →  services/transcription_service.py
(daemon/core layer)     (service layer — TranscriptionManager)
                        └── TranscriptionManager.run_transcription()
```

### Migration Steps

**Step 1: Add `run_transcription()` to `TranscriptionManager`**

In `mcp-backend/services/transcription_service.py`, add the transcription execution logic as a public instance method on the `TranscriptionManager` singleton:

```python
class TranscriptionManager:
    # ... existing __new__, __init__, model loading ...

    async def run_transcription(self, call_record_id: str) -> dict:
        """
        Execute transcription pipeline for a call record.
        Called by both the HTTP router and HorizonSentinel.

        Previously: module-level _run_transcription() in routers/transcriptions.py
        Moved here in PATCH-05 to break router/daemon coupling (C9).

        Args:
            call_record_id: UUID of the call_records row to transcribe

        Returns:
            dict with keys: transcript, executive_brief, sentiment, tags, status
        """
        # Move the body of _run_transcription() here verbatim.
        # Update any relative imports that assumed router-layer context.
        ...
```

**Step 2: Update `routers/transcriptions.py`**

Replace the module-level `_run_transcription()` function with a thin wrapper that delegates to `TranscriptionManager`:

```python
# routers/transcriptions.py

from mcp_backend.services.transcription_service import TranscriptionManager

# REMOVE: the full _run_transcription() function body

# KEEP: a thin shim for any existing HTTP route handlers that called it directly
async def _run_transcription(call_record_id: str) -> dict:
    """
    Deprecated shim — delegates to TranscriptionManager.run_transcription().
    Remove this shim once all callers have been updated to use TranscriptionManager directly.
    """
    manager = TranscriptionManager()
    return await manager.run_transcription(call_record_id)
```

**Step 3: Update `sentinel.py`**

```python
# sentinel.py — BEFORE
from mcp_backend.routers.transcriptions import _run_transcription

# sentinel.py — AFTER
from mcp_backend.services.transcription_service import TranscriptionManager

# In the audit cycle where transcription is triggered:
# BEFORE:
result = await _run_transcription(record_id)

# AFTER:
manager = TranscriptionManager()  # returns existing singleton — no re-init cost
result = await manager.run_transcription(record_id)
```

**Step 4: Verify singleton behavior is preserved**

`TranscriptionManager` uses `__new__` for singleton pattern — models are initialized once at startup and held in RAM. Confirm the sentinel calling `TranscriptionManager()` returns the already-initialized instance, not a new one:

```python
# In TranscriptionManager.__new__ or __init__, add an assertion:
assert hasattr(self, '_initialized'), "TranscriptionManager called before startup initialization"
```

**Step 5: Remove the shim** (after confirming no other callers of `_run_transcription` remain)

```bash
grep -r "_run_transcription" mcp-backend/
# Should return zero results after all callers are updated
# Then delete the shim function from routers/transcriptions.py
```

### Effort Note
This is a ~45-minute refactor. The main risk is import path resolution across the Python package. Run the full test suite (`pytest mcp-backend/`) after each step. If no tests exist yet for transcription, create a minimal smoke test before starting (see PROJECT_REQS.md REQ-216).

### Constitution Update Required
§7 `_run_transcription() Coupling` note — update to reflect resolved state. Remove C9 from §22 open issues.

---

## PATCH-06 — GPU Serial Task Queue: Constitution §7 Addition

### Problem
The critical hardware constraint for the HP Z2G3 Mini (Quadro M620, 2GB VRAM) — that Whisper and Pyannote **cannot run simultaneously** and must execute serially with GPU memory cleared between models — is documented only in `KNOWLEDGE2.md`. Any developer (or AI assistant) working on the transcription pipeline who hasn't read KNOWLEDGE2 will attempt to run both models in parallel and crash the workstation.

This constraint belongs in the Constitution §7 as a non-negotiable architectural rule, not a knowledge file that may not be read.

### Change

In `CONSTITUTION.pdf §7 — Transcription & Diarization Pipeline`, insert the following block **immediately after the Faster-Whisper parameters table** and **before the Pyannote Speaker Diarization section**:

---

**INSERT at §7 between the Whisper table and Pyannote section:**

```
Hardware Constraint — HP Z2G3 Mini (Quadro M620 2GB VRAM): Serial Execution Required

The transcription workstation has 2GB of VRAM. Faster-Whisper and Pyannote
speaker-diarization-3.1 cannot be loaded into GPU memory simultaneously without
triggering an Out of Memory (OOM) error that crashes the Python process.

Required execution order (non-negotiable):

  1. Load Pyannote pipeline → run diarization → del pipeline → torch.cuda.empty_cache()
  2. Load Whisper model → run transcription → (model remains in RAM as singleton)

This is the ONLY safe execution order on this hardware. Do NOT attempt to hold
both models in VRAM at the same time.

Fallback: If VRAM OOM errors occur during diarization, set the Pyannote pipeline
to CPU: diarize_pipeline.to(torch.device("cpu")). Diarization is less
compute-intensive than transcription; the CPU fallback adds ~15-20s per call but
prevents crashes.

CUDA compute types:
  - Whisper:  compute_type="int8_float16" (CUDA) / "int8" (CPU fallback)
  - Pyannote: torch.device(DEVICE) where DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

This constraint is encoded in TranscriptionManager and must not be changed
without verifying VRAM availability on the target hardware.
```

---

### Constitution Update Required
This is a documentation-only patch. Insert the block above into §7 of the Constitution. No code changes required — the serial execution logic already exists in `TranscriptionManager`. This patch formalizes it as a constitutional rule so it survives any future refactor.

---

## PATCH-07 — Encryption Key Startup Verifier

### Problem
If `FIELD_ENCRYPTION_MASTER_KEY` is missing, incorrectly set, or has been changed after transcripts were encrypted, the ingestion server starts silently and accepts new calls — but all new transcripts will be encrypted under the wrong key, and previously encrypted transcripts will be permanently unrecoverable. There is no current startup gate that catches this before data is written.

### File (create new)
`mcp-backend/core/security/verify_key.py`

### Implementation

```python
"""
verify_key.py — FIELD_ENCRYPTION_MASTER_KEY startup verifier

Runs at ingestion server startup (ingestion_server.py) before any routes are
registered. Performs a round-trip encrypt/decrypt test using the configured
master key.

On failure: logs a CRITICAL error and raises SystemExit(1), preventing the
server from starting in a state where it would silently corrupt data.

On success: logs confirmation and returns.

See Constitution §8 — Transcript Encryption (REQ-037).
"""

import base64
import logging
import os
import sys

logger = logging.getLogger("horizon.startup")

# Canary value: a stable known string we encrypt and decrypt to verify the key works.
_CANARY_PLAINTEXT = b"horizon-key-verification-canary-v1"


def verify_encryption_key() -> None:
    """
    Verifies FIELD_ENCRYPTION_MASTER_KEY is present and functional.
    Raises SystemExit(1) if verification fails.
    Call this BEFORE registering any routes in ingestion_server.py.
    """
    master_key = os.environ.get("FIELD_ENCRYPTION_MASTER_KEY")

    # ── 1. Presence check ────────────────────────────────────────────────
    if not master_key:
        logger.critical(
            "STARTUP FAILURE: FIELD_ENCRYPTION_MASTER_KEY is not set.\n"
            "All transcript data requires this key for AES-256-GCM encryption.\n"
            "If you have lost this key, existing encrypted transcripts are UNRECOVERABLE.\n"
            "Generate a new key with: python -c \"import secrets; print(secrets.token_urlsafe(32))\"\n"
            "Store it in a password manager SEPARATE from this codebase."
        )
        sys.exit(1)

    # ── 2. Import crypto module (validates it loads without error) ────────
    try:
        from mcp_backend.core.security.crypto import encrypt_data, decrypt_data
    except ImportError as e:
        logger.critical(f"STARTUP FAILURE: Cannot import crypto module: {e}")
        sys.exit(1)

    # ── 3. Round-trip test ────────────────────────────────────────────────
    try:
        ciphertext_b64, iv_b64 = encrypt_data(_CANARY_PLAINTEXT.decode())
    except Exception as e:
        logger.critical(
            f"STARTUP FAILURE: FIELD_ENCRYPTION_MASTER_KEY failed encryption test.\n"
            f"Error: {e}\n"
            f"This key may be malformed or corrupted."
        )
        sys.exit(1)

    try:
        recovered = decrypt_data(ciphertext_b64, iv_b64)
    except Exception as e:
        logger.critical(
            f"STARTUP FAILURE: FIELD_ENCRYPTION_MASTER_KEY failed decryption test.\n"
            f"Error: {e}\n"
            f"The key may have changed since transcripts were encrypted, or the key is malformed.\n"
            f"⚠️  DO NOT delete this key — existing transcripts encrypted under it would be lost."
        )
        sys.exit(1)

    # ── 4. Value integrity check ──────────────────────────────────────────
    if recovered.encode() != _CANARY_PLAINTEXT:
        logger.critical(
            "STARTUP FAILURE: FIELD_ENCRYPTION_MASTER_KEY round-trip integrity check failed.\n"
            "Encrypted and decrypted values do not match — key may be corrupted."
        )
        sys.exit(1)

    # ── 5. Key length warning ─────────────────────────────────────────────
    # token_urlsafe(32) produces ~43 chars. Warn if significantly shorter.
    if len(master_key) < 32:
        logger.warning(
            f"FIELD_ENCRYPTION_MASTER_KEY is {len(master_key)} characters — "
            f"recommended minimum is 43 (output of secrets.token_urlsafe(32)). "
            f"Consider rotating to a stronger key."
        )

    logger.info(
        f"✓ FIELD_ENCRYPTION_MASTER_KEY verified — "
        f"key length: {len(master_key)} chars, round-trip: PASS"
    )
```

### Integration Point

In `mcp-backend/ingestion_server.py`, in the startup sequence **between** `init_supabase()` and `asyncio.create_task(sentinel.run())`:

```python
# ingestion_server.py — Startup Sequence (updated)

# Step 1: Strip null bytes from .env (existing)
# Step 2: init_supabase() (existing)

# Step 3: NEW — verify encryption key before sentinel starts
from mcp_backend.core.security.verify_key import verify_encryption_key
verify_encryption_key()  # raises SystemExit(1) on failure — intentional

# Step 4: asyncio.create_task(sentinel.run()) (existing)
# Step 5: Log HORIZON_API_KEY prefix (existing)
```

**Why between init_supabase and sentinel?** The sentinel handles transcription records that require encryption. Starting it before key verification would allow records to be processed under a bad key.

### Test It

```bash
# Test 1: Missing key
unset FIELD_ENCRYPTION_MASTER_KEY
cd mcp-backend && uvicorn ingestion_server:app --host 0.0.0.0 --port 9000
# Expected: CRITICAL log → server exits immediately

# Test 2: Valid key
export FIELD_ENCRYPTION_MASTER_KEY="your-actual-key"
cd mcp-backend && uvicorn ingestion_server:app --host 0.0.0.0 --port 9000
# Expected: "✓ FIELD_ENCRYPTION_MASTER_KEY verified" in logs, server starts normally

# Test 3: Wrong key (simulate key rotation scenario)
export FIELD_ENCRYPTION_MASTER_KEY="definitely-wrong-key-aaaaaaaaaaaa"
cd mcp-backend && uvicorn ingestion_server:app --host 0.0.0.0 --port 9000
# Expected: CRITICAL log with key rotation warning → server exits
```

### Constitution Update Required
§8 Transcript Encryption — add a note: "The ingestion server runs `verify_encryption_key()` on startup. If the key is missing or fails the round-trip test, the server refuses to start." Also add `verify_key.py` to the file inventory in §4.

---

## PATCH-08 — Constitution §22 Status Update

After all patches above are applied, §22 Known Issues should be updated to reflect current state. The following represents the target state:

| Issue | Status | Resolved In |
|---|---|---|
| C1 — auditor.py OPENAI_API_KEY | ✅ FIXED | v3.0 |
| C2 — HUGGINGFACE_TOKEN .env.example | ✅ FIXED | v3.0 |
| C3 — FIELD_ENCRYPTION_MASTER_KEY .env.example | ✅ FIXED | v3.0 |
| C4 — socket.io-client dead dependency | ✅ FIXED | PATCH-03 |
| C5 — VITE_BACKEND_URL_MOBILE | ✅ RESOLVED (already correct) | v3.0 |
| C6 — Supervisor --reload in production | ✅ FIXED | PATCH-01 |
| C7 — @google/clasp in production deps | ✅ FIXED | PATCH-03 |
| C8 — GuardianService cosmetic loop naming | ✅ FIXED | PATCH-04 |
| C9 — _run_transcription() router coupling | ✅ FIXED | PATCH-05 |
| C10 — sourcemap: true in production | ✅ FIXED | PATCH-02 |
| **NEW: GPU serial task queue undocumented** | ✅ DOCUMENTED | PATCH-06 |
| **NEW: Encryption key startup verification** | ✅ IMPLEMENTED | PATCH-07 |

### Constitution Change Log Addition (§23)

Add the following entry to the change log:

```
| 2026-06 | 4.0 | Technical Corrections pass. Resolved C4, C6, C7, C8, C9, C10.
|         |     | Added PATCH-06 (GPU serial constraint to §7) and PATCH-07
|         |     | (encryption key verifier). Design token system migrated to
|         |     | DESIGN_TOKENS.md v4.0 — ochre restored as canonical brand accent.
|         |     | Constitution §14 superseded by DESIGN_TOKENS.md.
```

---

## Application Order

Apply patches in this sequence to minimize risk of conflicts:

```
PATCH-02 → PATCH-03 → PATCH-01 → PATCH-07 → PATCH-04 → PATCH-06 → PATCH-05 → PATCH-08
```

Rationale: Start with the zero-risk config changes (02, 03), then the startup safety gate (07 — because it needs to work before you test 01), then the supervisor fix (01), then documentation and naming (04, 06), then the structural refactor (05 — highest risk, do last), then the Constitution update (08 — reflects all prior work).

---

*End of TECHNICAL_CORRECTIONS.md*  
*Cross-reference: DESIGN_TOKENS.md v4.0 for all token-related corrections.*  
*Next document in sequence: CONSTITUTION_v4_SECTION7_GPU.md or PROJECT_REQS_PRIORITIZED.md*