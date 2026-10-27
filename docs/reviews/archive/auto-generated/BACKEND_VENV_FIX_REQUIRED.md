# Backend Virtual Environment Fix Required

**Date**: 2026-06-21 08:15 UTC  
**Priority**: 🔴 **CRITICAL**  
**Estimated Fix Time**: 15 minutes  
**Status**: Automated fix failed — manual intervention needed

═══════════════════════════════════════════════════════════════════════════════

## Issue Summary

Backend pytest tests are **FAILING** due to missing `google-genai` package in the Python virtual environment.

```bash
ERROR tests/test_ingestion.py
ImportError: cannot import name 'genai' from 'google' (unknown location)
```

## Automated Fix Attempt

The automated review attempted to install the missing dependency but encountered:
- ❌ Permissions error when upgrading pip
- ❌ Unable to install `google-genai` package

**Error Details**:
```
Check the permissions.
[notice] A new release of pip is available: 26.0.1 -> 26.1.2
```

**Possible Causes**:
1. Backend process is running and has the venv locked
2. File permissions issue in venv directory
3. venv may need to be recreated

═══════════════════════════════════════════════════════════════════════════════

## Manual Resolution (15 Minutes)

### Step 1: Stop Backend Processes
```powershell
# Check if backend is running
Get-Process | Where-Object {$_.Path -like "*mcp-backend*"}

# If running, stop it
# Find the process ID and stop it, or close the terminal running uvicorn
```

### Step 2: Activate Virtual Environment
```powershell
cd C:\Users\owner\Desktop\horizon\mcp-backend
.\venv\Scripts\Activate.ps1
```

**Verify activation**:
```powershell
(venv) PS> python -c "import sys; print(sys.executable)"
# Expected: C:\Users\owner\Desktop\horizon\mcp-backend\venv\Scripts\python.exe
```

### Step 3: Install Missing Dependency
```powershell
(venv) PS> pip install google-genai>=1.16.0
```

**If permissions error persists**, run PowerShell as Administrator:
```powershell
# Right-click PowerShell -> Run as Administrator
cd C:\Users\owner\Desktop\horizon\mcp-backend
.\venv\Scripts\Activate.ps1
pip install google-genai>=1.16.0
```

### Step 4: Verify Installation
```powershell
(venv) PS> python -c "from google import genai; print('✅ google-genai available')"
# Expected output: ✅ google-genai available
```

### Step 5: Run Backend Tests
```powershell
(venv) PS> python -m pytest tests/ -v
```

**Expected**: Tests should pass (or reveal other issues, but not the ImportError).

═══════════════════════════════════════════════════════════════════════════════

## Alternative: Recreate Virtual Environment

If the above steps fail due to venv corruption:

```powershell
# Backup current venv (optional)
cd C:\Users\owner\Desktop\horizon\mcp-backend
Rename-Item venv venv.bak

# Create fresh venv
python -m venv venv

# Activate
.\venv\Scripts\Activate.ps1

# Install all dependencies
pip install -r requirements.txt

# Verify
python -m pytest tests/ -v
```

═══════════════════════════════════════════════════════════════════════════════

## Impact Assessment

### Production Risk: 🔴 HIGH

**Affected Endpoints**:
- `/api/v1/ai/brief` — Gemini 2.0 Flash call brief generation
- Any service using `google.genai` module

**Current Runtime Status**:
- ✅ Port 8000 is responding
- ✅ Health endpoint returns `{"status":"ok","db_connected":true}`
- ⚠️ Unknown if AI brief endpoint is functional (needs testing)

**Recommendation**: Test AI brief endpoint before assuming production readiness:
```powershell
curl -X POST http://localhost:8000/api/v1/ai/brief \
  -H "Content-Type: application/json" \
  -d '{"transcript":"Test transcript for AI brief generation"}'
```

═══════════════════════════════════════════════════════════════════════════════

## Post-Fix Verification Checklist

After fixing the venv issue:

- [ ] Backend venv activated: `.\venv\Scripts\Activate.ps1`
- [ ] `google-genai` installed: `pip list | Select-String google-genai`
- [ ] Import works: `python -c "from google import genai"`
- [ ] Backend tests pass: `python -m pytest tests/ -v`
- [ ] AI brief endpoint tested: POST to `/api/v1/ai/brief`
- [ ] Update engineering review with resolution status

═══════════════════════════════════════════════════════════════════════════════

## Related Documentation

- **Comprehensive Engineering Review**: ENGINEERING_REVIEW_2026-06-21_AUTOMATED.md
- **Original Issue Report**: CRITICAL_UPDATE_2026-06-21_03-15.md
- **Backend Requirements**: mcp-backend/requirements.txt

═══════════════════════════════════════════════════════════════════════════════

**Next Action**: Follow Steps 1-5 above to resolve the venv dependency issue.

**Estimated Time**: 15 minutes  
**Blocking**: Production deployment  
**Severity**: 🔴 CRITICAL
