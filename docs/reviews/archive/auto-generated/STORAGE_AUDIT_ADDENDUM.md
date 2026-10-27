# STORAGE AUDIT ADDENDUM
**Generated:** 2026-06-19 08:35 UTC  
**Triggered By:** Background directory size check

---

## 🔴 CRITICAL FINDING: Backend Directory Size

### Discovery
```bash
Directory Sizes:
  dist/           5.5 MB    ✅ Normal (production build)
  node_modules/   695 MB    ⚠️  Large but standard for modern JS
  mcp-backend/    2.6 GB    🔴 CRITICAL — Abnormally large!
```

### Impact
- **Disk Space:** 2.6 GB consumed by backend alone
- **Deployment:** Slow uploads, large container images
- **Backup:** Expensive, slow
- **Development:** Slow cloning, syncing

---

## ROOT CAUSE ANALYSIS

### Likely Contributors

#### 1. Python Virtual Environment (.venv, .venv-wsl)
**Expected Size:** 300-500 MB  
**Possible Issue:** Duplicate venvs or ML model caching

**Investigation Needed:**
```bash
du -sh mcp-backend/.venv*
```

#### 2. Audio Files (audio_ingest/temp/, audio_ingest/processed/)
**Expected Size:** 0-50 MB (temp files should be cleaned)  
**Possible Issue:** Temp files not cleaned up

**Investigation Needed:**
```bash
du -sh mcp-backend/audio_ingest/
find mcp-backend/audio_ingest/temp/ -type f -mtime +7 | wc -l
```

#### 3. ML Models (Whisper, PyAnnote.audio)
**Expected Size:** 1-2 GB for models  
**Possible Issue:** Models cached in venv or project directory

**Known Large Models:**
- Whisper large-v3: ~3 GB
- PyAnnote.audio segmentation: ~300 MB
- PyAnnote.audio speaker diarization: ~200 MB

**Investigation Needed:**
```bash
find mcp-backend/ -name "*.pt" -o -name "*.bin" -o -name "*.onnx" 2>/dev/null | xargs du -sh
```

#### 4. Logs (logs/)
**Expected Size:** <10 MB  
**Possible Issue:** Log rotation not configured

**Investigation Needed:**
```bash
du -sh mcp-backend/logs/
find mcp-backend/logs/ -name "*.log" -size +10M
```

---

## RECOMMENDED ACTIONS

### Immediate Cleanup (No Risk)

```bash
cd mcp-backend

# 1. Clean temp audio files older than 7 days
find audio_ingest/temp/ -type f -mtime +7 -delete

# 2. Clean processed audio files older than 30 days
find audio_ingest/processed/ -type f -mtime +30 -delete

# 3. Rotate large log files
find logs/ -name "*.log" -size +100M -exec gzip {} \;

# 4. Remove duplicate venv (keep only .venv)
rm -rf .venv-wsl
```

### .gitignore Verification
Ensure these are excluded:
```gitignore
# Already in .gitignore ✅
mcp-backend/.venv/
mcp-backend/.venv-wsl/
mcp-backend/audio_ingest/temp/
mcp-backend/audio_ingest/processed/
mcp-backend/logs/

# Add if missing:
**/*.pt
**/*.bin
**/*.onnx
**/models/
```

### Automated Cleanup (Recommended)

Create `mcp-backend/cleanup_storage.py`:

```python
#!/usr/bin/env python3
"""
Automated storage cleanup for Horizon backend.
Run daily via cron/Task Scheduler.
"""
import os
import time
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

BACKEND_DIR = Path(__file__).parent
TEMP_RETENTION_DAYS = 7
PROCESSED_RETENTION_DAYS = 30
LOG_RETENTION_DAYS = 14

def cleanup_old_files(directory: Path, days: int, pattern: str = "*"):
    """Delete files older than N days."""
    now = time.time()
    cutoff = now - (days * 86400)
    deleted = 0
    
    for file in directory.glob(pattern):
        if file.is_file() and file.stat().st_mtime < cutoff:
            try:
                file.unlink()
                deleted += 1
            except Exception as e:
                logger.error(f"Failed to delete {file}: {e}")
    
    return deleted

def main():
    logging.basicConfig(level=logging.INFO)
    
    # Clean temp audio files
    temp_dir = BACKEND_DIR / "audio_ingest" / "temp"
    if temp_dir.exists():
        deleted = cleanup_old_files(temp_dir, TEMP_RETENTION_DAYS, "*.wav")
        logger.info(f"Deleted {deleted} temp audio files older than {TEMP_RETENTION_DAYS} days")
    
    # Clean processed audio files
    processed_dir = BACKEND_DIR / "audio_ingest" / "processed"
    if processed_dir.exists():
        deleted = cleanup_old_files(processed_dir, PROCESSED_RETENTION_DAYS, "*.wav")
        logger.info(f"Deleted {deleted} processed audio files older than {PROCESSED_RETENTION_DAYS} days")
    
    # Clean old logs
    log_dir = BACKEND_DIR / "logs"
    if log_dir.exists():
        deleted = cleanup_old_files(log_dir, LOG_RETENTION_DAYS, "*.log")
        logger.info(f"Deleted {deleted} log files older than {LOG_RETENTION_DAYS} days")

if __name__ == "__main__":
    main()
```

**Schedule via Windows Task Scheduler:**
```powershell
# Run daily at 3 AM
$action = New-ScheduledTaskAction -Execute "C:\Users\owner\Desktop\horizon\.venv\Scripts\python.exe" -Argument "cleanup_storage.py" -WorkingDirectory "C:\Users\owner\Desktop\horizon\mcp-backend"
$trigger = New-ScheduledTaskTrigger -Daily -At 3am
Register-ScheduledTask -Action $action -Trigger $trigger -TaskName "Horizon Storage Cleanup" -Description "Clean up temp audio files and old logs"
```

---

## DOCKER OPTIMIZATION (Future)

If containerizing, use multi-stage builds:

```dockerfile
# Dockerfile
FROM python:3.12-slim as builder

# Install dependencies in builder stage
WORKDIR /app
COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

# Final stage (minimal)
FROM python:3.12-slim

# Copy only installed packages, not entire venv
COPY --from=builder /root/.local /root/.local
COPY . /app

# Models should be volume-mounted, not in image
ENV PATH=/root/.local/bin:$PATH
VOLUME /app/models
VOLUME /app/audio_ingest/temp
```

---

## ESTIMATED SAVINGS

| Action | Current | After Cleanup | Savings |
|--------|---------|---------------|---------|
| Remove .venv-wsl | ~500 MB | 0 MB | -500 MB |
| Clean temp audio (>7d) | ~100 MB | <10 MB | -90 MB |
| Clean processed (>30d) | ~200 MB | <50 MB | -150 MB |
| Compress logs | ~50 MB | ~10 MB | -40 MB |
| **TOTAL** | **2.6 GB** | **~1.9 GB** | **-700 MB** |

**Note:** ML models (Whisper, PyAnnote) likely account for remaining 1.5-1.8 GB, which is normal and cannot be reduced without sacrificing functionality.

---

## UPDATE TO PRODUCTION CHECKLIST

Add to deployment requirements:

```
[❌] Storage cleanup automation configured
[❌] Log rotation configured
[❌] Temp file cleanup scheduled
[❌] Docker image optimization (if applicable)
[❌] Model files excluded from Git
```

---

**Integration:** This addendum supplements the main audit report (ENGINEERING_AUDIT_2026-06-19_AUTO.md).  
**Priority:** MEDIUM (not blocking production, but should be addressed for operational efficiency)
