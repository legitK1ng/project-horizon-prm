# IMMEDIATE ACTION ITEMS
**Generated:** 2026-06-22 21:14 UTC  
**Priority:** HIGH  
**Source:** Automated Engineering Review

═══════════════════════════════════════════════════════════════════════════════

## 🔴 CRITICAL — Immediate Attention Required

### 1. Clean Up Orphaned Backend Processes
**Issue:** 17 Python processes bound to port 9000 (consuming 3.5-8.5 GB RAM)

**Fix:**
```powershell
# Kill all Python processes on port 9000
Get-NetTCPConnection -LocalPort 9000 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }

# Wait for cleanup
Start-Sleep -Seconds 2

# Restart single backend instance
cd C:\Users\owner\Desktop\horizon\mcp-backend
.\.venv\Scripts\Activate.ps1
uvicorn main:app --host 0.0.0.0 --port 9000 --reload
```

**Impact:** Reclaim 3-8 GB RAM, prevent socket exhaustion

═══════════════════════════════════════════════════════════════════════════════

## 🟡 MODERATE — Before Next Deployment

### 2. Resolve Unstaged File Status
**Issue:** 20 modified files with unstaged changes (including `test_ingestion.py` with both staged + unstaged)

**Action Required:**
```bash
# Review changes
git status

# Option A: Commit changes
git add .
git commit -m "chore: apply engineering review fixes"

# Option B: Discard unstaged changes
git restore .
```

**Impact:** Clean git state, prevent merge conflicts

### 3. Install Test Coverage Tool
**Issue:** Missing `@vitest/coverage-v8` dependency

**Fix:**
```bash
npm install --save-dev @vitest/coverage-v8
npm run test:coverage
```

**Impact:** Enable coverage reporting, identify untested code paths

### 4. Suppress Build Chunk Warning
**Issue:** Mermaid ELK layout engine causes 1.45 MB chunk (expected behavior)

**Fix in `vite.config.ts`:**
```typescript
build: {
  chunkSizeWarningLimit: 1500,  // Add this line
  outDir: 'dist',
  // ... rest of config
}
```

**Impact:** Remove noisy warning from build output

═══════════════════════════════════════════════════════════════════════════════

## 🟢 LOW — Future Enhancements

### 5. Add Process Management Script
**Create:** `scripts/restart-backend.ps1`

```powershell
# Restart backend with automatic orphan cleanup
$port = 9000
Write-Host "Cleaning up processes on port $port..." -ForegroundColor Yellow

Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | 
  ForEach-Object { 
    Write-Host "Killing process $($_.OwningProcess)" -ForegroundColor Red
    Stop-Process -Id $_.OwningProcess -Force 
  }

Start-Sleep -Seconds 2
Write-Host "Starting backend..." -ForegroundColor Green

cd mcp-backend
.\.venv\Scripts\Activate.ps1
uvicorn main:app --host 0.0.0.0 --port $port --reload
```

**Usage:**
```powershell
.\scripts\restart-backend.ps1
```

### 6. Add Key Rotation Documentation
**Create:** `docs/OPERATIONS.md` → Add "Encryption Key Rotation" section

**Procedure:**
1. Generate new key: `python -c "import secrets; print(secrets.token_urlsafe(32))"`
2. Decrypt all transcripts with old key
3. Re-encrypt with new key
4. Update `FIELD_ENCRYPTION_MASTER_KEY` in `.env`
5. Restart backend
6. Verify decryption with new key

### 7. Add Playwright E2E Tests
**Coverage Needed:**
- Login → Dashboard → View Contact → View Call Record
- Manual call ingestion via IngestionSettings
- Google Contacts sync flow
- Contact enrichment trigger

**Setup:**
```bash
npm install --save-dev @playwright/test
npx playwright install
```

**Create:** `tests/e2e/critical-flows.spec.ts`

═══════════════════════════════════════════════════════════════════════════════

## Summary

**Critical Issues:** 1 (orphaned processes)  
**Moderate Issues:** 3 (unstaged files, coverage tool, build warning)  
**Future Enhancements:** 3 (process script, key rotation docs, e2e tests)

**Estimated Time:**
- 🔴 Critical: 5 minutes
- 🟡 Moderate: 15 minutes
- 🟢 Future: 2-4 hours

**Production Readiness After Fixes:** ✅ **100% READY**
