# Quick Action Checklist — 2026-06-19 (Scheduled Audit)

**Generated:** June 19, 2026 @ 12:12 UTC  
**Priority:** SHIP-BLOCKING & HIGH-PRIORITY FIXES  
**Estimated Total Effort:** 2-4 hours

---

## ❌ SHIP-BLOCKING (Must Fix Before Production)

### 1. Security Vulnerabilities ⚠️ HIGH PRIORITY
**Issue:** 6 npm security vulnerabilities (3 HIGH, 3 MODERATE)

**Affected Packages:**
- `@xmldom/xmldom` — XML injection, DoS
- `undici` — WebSocket crashes, HTTP smuggling
- `ws` — Memory disclosure, DoS
- `dompurify` — Attribute pollution
- `tar` — File smuggling
- `uuid` — Buffer overflow
- `@google/clasp` — Path traversal

**Fix:**
```bash
# Terminal 1: Fix non-breaking vulnerabilities
npm audit fix

# Terminal 2: Test breaking changes in isolation
npm audit fix --force --dry-run
# If safe, run: npm audit fix --force
```

**Verification:**
```bash
npm audit --production
# Expected: 0 vulnerabilities
```

**Time Estimate:** 15 minutes  
**Risk:** LOW (audit fix is generally safe)

---

### 2. API Health Endpoint 404 ⚠️ HIGH PRIORITY
**Issue:** Health endpoints return `{"detail":"Not Found"}` on all tested routes

**Impact:** Cloud Run readiness probes will fail → deployment blocked

**Root Cause:** Router prefix mismatch in `main.py`

**Fix:**
```python
# File: mcp-backend/main.py
# Add after router imports (around line 110):

# Root health endpoint for load balancers
@app.get("/health")
async def root_health():
    return {"status": "ok", "service": "horizon-prm-api"}

# Ensure health router is registered correctly
app.include_router(health.router, prefix="/api/v1/health", tags=["health"])
```

**Verification:**
```bash
# Test root health
curl http://localhost:9000/health
# Expected: {"status":"ok","service":"horizon-prm-api"}

# Test versioned health
curl http://localhost:9000/api/v1/health
# Expected: {"status":"ok","version":"1.0.0","db_connected":true,...}
```

**Time Estimate:** 10 minutes  
**Risk:** LOW

---

### 3. Build Verification Failure 🔴 CRITICAL
**Issue:** Frontend production build failed (exit code 255)

**Action Required:**
```bash
# Check build errors
npm run build

# Common issues to check:
# 1. TypeScript errors (should pass already)
# 2. Missing environment variables
# 3. Import path issues
# 4. Memory limits
```

**If build fails:**
1. Read build error output
2. Fix reported issues
3. Re-run `npm run build`
4. Verify `dist/` directory populated
5. Check bundle size: `ls -lh dist/assets/`

**Time Estimate:** 30 minutes (debugging dependent)  
**Risk:** MEDIUM

---

## ⚠️ HIGH PRIORITY (Fix Before Deployment)

### 4. Test Suite Failures
**Issue:** 3 Vitest tests failing + Playwright misconfiguration

**Part A: Fix API Test Mocks**

```typescript
// File: src/utils/testUtils.ts
export const mockFetch = (url: string) => {
  if (url.includes('/stats')) {
    return Promise.resolve({
      ok: true,
      json: async () => ({
        totalContacts: 42,
        totalCalls: 120,
        totalNudges: 8,
        activeNudges: 5,
        weeklyActivity: []
      })
    });
  }
  
  if (url.includes('/models')) {
    return Promise.resolve({
      ok: true,
      json: async () => ({
        models: [{ name: 'gemini-1.5-flash', status: 'active' }]
      })
    });
  }
  
  if (url.includes('/health')) {
    return Promise.resolve({
      ok: true,
      json: async () => ({
        status: 'healthy',
        version: '1.0.0',
        db_connected: true
      })
    });
  }
  
  return Promise.resolve({
    ok: false,
    json: async () => ({ error: 'Not mocked' })
  });
};
```

**Part B: Fix Vitest/Playwright Conflict**

```typescript
// File: vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    exclude: [
      'node_modules/**',
      'tests/**/*.spec.ts',  // Exclude Playwright tests
      'dist/**',
      'playwright-report/**'
    ],
    setupFiles: './src/utils/testSetup.ts'
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
```

**Verification:**
```bash
# Run unit tests (Vitest)
npm run test

# Run E2E tests (Playwright)
npx playwright test

# Both should pass
```

**Time Estimate:** 45 minutes  
**Risk:** LOW

---

## 📋 MEDIUM PRIORITY (Post-Launch Acceptable)

### 5. Repository Cleanup
**Issue:** 20+ duplicate audit/review files in root directory

**Fix:**
```bash
# Create archive structure
mkdir -p docs/audits/archive

# Move old review files
mv ENGINEERING_AUDIT_2026-06-19_*.md docs/audits/archive/ 2>/dev/null
mv ENGINEERING_REVIEW_*.md docs/audits/archive/ 2>/dev/null
mv EXEC_SUMMARY_*.txt docs/audits/archive/ 2>/dev/null
mv REVIEW_*.md docs/audits/archive/ 2>/dev/null
mv QUICK_ACTION_*.md docs/audits/archive/ 2>/dev/null

# Keep only the final report
cp ENGINEERING_AUDIT_2026-06-19_SCHEDULED_FINAL.md docs/audits/
```

**Update .gitignore:**
```gitignore
# Audit archives (keep only in docs/)
/ENGINEERING_AUDIT_*.md
/ENGINEERING_REVIEW_*.md
/EXEC_SUMMARY_*.txt
/REVIEW_*.md
/QUICK_ACTION_*.md

# But allow in docs/
!/docs/audits/*.md
```

**Time Estimate:** 15 minutes  
**Risk:** NONE

---

### 6. Log File Management
**Issue:** Large supervisor log (121KB) and old error logs

**Fix:**
```bash
# Backend logs
cd mcp-backend

# Archive current supervisor log
mv supervisor_out.log logs/supervisor_out_$(date +%Y%m%d).log

# Create fresh log
touch supervisor_out.log

# Clean old error dumps in root
cd ..
rm -f tsc_errors*.log hs_err_pid*.log replay_pid*.log
```

**Update .gitignore:**
```gitignore
# Log files
*.log
supervisor_*.log
mcp-backend/logs/

# JVM crash logs
hs_err_pid*.log
replay_pid*.log
```

**Time Estimate:** 10 minutes  
**Risk:** NONE

---

## 🧪 VALIDATION CHECKLIST

After completing fixes, verify the following:

**Backend Health:**
```bash
# 1. Services running
curl http://localhost:9000/health
# Expected: {"status":"ok",...}

# 2. Database connected
curl http://localhost:9000/api/v1/health
# Expected: {"db_connected":true,...}

# 3. Supervisor status
tail -20 mcp-backend/supervisor_out.log
# Expected: Both services HEALTHY
```

**Frontend Build:**
```bash
# 1. Build succeeds
npm run build
# Expected: Exit code 0

# 2. Artifacts generated
ls -lh dist/assets/
# Expected: index-*.js, index-*.css files

# 3. Bundle size reasonable
du -sh dist/
# Expected: <5MB total
```

**Tests:**
```bash
# 1. Unit tests pass
npm run test
# Expected: All tests passing

# 2. Type check passes
npm run type-check
# Expected: No errors

# 3. Lint passes
npm run lint
# Expected: No warnings/errors
```

**Security:**
```bash
# 1. No vulnerabilities
npm audit --production
# Expected: 0 vulnerabilities

# 2. Dependencies up to date
npm outdated
# Expected: No critical updates
```

---

## 🚀 DEPLOYMENT READINESS SCORECARD

| Check | Status | Blocker? |
|-------|--------|----------|
| Security vulnerabilities fixed | ❌ | YES |
| Health endpoints working | ❌ | YES |
| Production build succeeds | ❌ | YES |
| Unit tests passing | ❌ | NO* |
| E2E tests passing | ⚠️ | NO |
| Repository cleaned | ⚠️ | NO |
| Logs archived | ⚠️ | NO |

**\*Note:** Test failures are NOT ship-blocking if manual QA confirms functionality, but should be fixed ASAP.

---

## ⏱️ TIME BUDGET SUMMARY

**Critical Path (Ship-Blocking):**
1. Security fixes: 15 min
2. Health endpoint: 10 min
3. Build debugging: 30 min
4. **Total Critical:** ~55 minutes

**High Priority:**
1. Test mock fixes: 30 min
2. Vitest config: 15 min
3. **Total High:** ~45 minutes

**Medium Priority:**
1. Repository cleanup: 15 min
2. Log management: 10 min
3. **Total Medium:** ~25 minutes

**Grand Total:** ~2 hours 5 minutes

---

## 🎯 RECOMMENDED EXECUTION ORDER

1. **Security fixes** (15 min) → Unblocks deployment
2. **Health endpoint** (10 min) → Unblocks Cloud Run
3. **Build debugging** (30 min) → Verify production artifacts
4. **Test mocks** (30 min) → Restore CI confidence
5. **Vitest config** (15 min) → Clean test separation
6. *(Optional)* Repository cleanup (25 min) → Cosmetic

**Stop Point:** After step 3, you have a deployable system. Steps 4-6 improve quality but aren't blockers.

---

## 📞 ESCALATION

If any fix exceeds estimated time by 2x:
1. Document the blocker
2. Consider deploying without that fix (if not ship-blocking)
3. Create follow-up task for post-launch

**Rollback Plan:** All changes are configuration/dependency updates. If deployment fails:
1. Revert `package-lock.json`: `git checkout HEAD -- package-lock.json`
2. Reinstall: `npm ci`
3. Restart backend: `cd mcp-backend && python main.py`

---

**Checklist Owner:** Engineering Agent (Autonomous)  
**Review Required:** YES (user should verify fixes before deploying)  
**Next Review:** After all fixes completed
