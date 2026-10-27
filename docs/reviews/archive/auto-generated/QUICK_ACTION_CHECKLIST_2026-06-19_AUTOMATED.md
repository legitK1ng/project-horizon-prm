# QUICK ACTION CHECKLIST — Horizon PRM
**Generated:** 2026-06-19 (Automated 24hr Review)

## CRITICAL FIXES (Must Do Today)

### 1. Security Vulnerabilities (5 minutes)
```bash
npm audit fix
npm run build  # Verify no breakage
```

**What it fixes:**
- undici (10 CVEs): WebSocket attacks, HTTP smuggling
- ws (1 CVE): Memory disclosure
- @xmldom/xmldom (5 CVEs): XML injection
- dompurify, tar, uuid (3 moderate CVEs)

### 2. Fix Unit Test Mocks (30 minutes)
**File:** `src/utils/testUtils.ts`

**Issue:** Mocks return wrong shape for API responses

**Fix:**
```typescript
// Update mockFetch to return correct shape
export const mockFetch = (url: string) => {
  if (url.includes('/stats')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        totalContacts: 42,  // Add this
        // ... other stats
      })
    });
  }
  // ... rest of mocks
};
```

**Verify:**
```bash
npm run test  # Should see 3 tests pass
```

### 3. Fix Playwright Test Configuration (15 minutes)
**Issue:** Playwright tests in `tests/` being picked up by Vitest

**Fix:**
```bash
# Create e2e directory
mkdir e2e

# Move Playwright tests
mv tests/phase3.spec.ts e2e/
mv tests/sprint5.spec.ts e2e/
mv tests/ux-improvements.spec.ts e2e/

# Create playwright.config.ts
cat > playwright.config.ts << EOF
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:3000',
  },
});
EOF

# Update package.json
# Add: "test:e2e": "playwright test"
```

**Verify:**
```bash
npm run test       # Should not pick up Playwright tests
npm run test:e2e   # Should run E2E tests separately
```

---

## HIGH PRIORITY (This Week)

### 4. Add CI/CD Pipeline (1 hour)
**File:** `.github/workflows/ci.yml`

```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run test
      - run: npm run build
```

### 5. Implement Rate Limiting (2 hours)
**File:** `mcp-backend/main.py`

```python
# Add slowapi middleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Apply to routes:
@router.post("/batch-ingest")
@limiter.limit("5/minute")  # 5 requests per minute
async def trigger_batch_ingest(...):
    ...
```

### 6. Optimize Bundle Sizes (2 hours)
**File:** `vite.config.ts`

```javascript
// Fix manual chunks
manualChunks(id) {
  if (id.includes('node_modules')) {
    if (id.includes('react') || id.includes('react-dom')) {
      return 'react-vendor';
    }
    if (id.includes('mermaid')) {
      return 'mermaid';
    }
    if (id.includes('recharts')) {
      return 'charts';
    }
    return 'vendor';
  }
}
```

**Lazy-load Mermaid:**
```typescript
const MermaidDiagram = lazy(() => import('./components/MermaidDiagram'));
```

---

## MEDIUM PRIORITY (Before v1.0)

### 7. Add Supabase RLS Policies (4 hours)
```sql
-- Enable RLS
ALTER TABLE call_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_recordings ENABLE ROW LEVEL SECURITY;

-- Example policy
CREATE POLICY "Users can view own records"
ON call_records FOR SELECT
USING (auth.uid() = user_id);
```

### 8. Add Docker Support (2 hours)
**File:** `Dockerfile`

```dockerfile
FROM node:18-alpine AS frontend
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
COPY mcp-backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY mcp-backend/ ./mcp-backend/
COPY --from=frontend /app/dist ./dist
CMD ["uvicorn", "mcp-backend.main:app", "--host", "0.0.0.0", "--port", "9000"]
```

---

## VERIFICATION COMMANDS

After each fix:
```bash
# Lint check
npm run lint

# Type check
npm run type-check

# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Build
npm run build

# Security
npm audit --production
```

---

## TIMELINE

**Today (4-6 hours):**
- ✅ Security fixes (5 min)
- ✅ Test mocks (30 min)
- ✅ Playwright config (15 min)
- ✅ Verification (10 min)

**This Week (12 hours):**
- CI/CD pipeline (1 hour)
- Rate limiting (2 hours)
- Bundle optimization (2 hours)
- Integration tests (4 hours)
- Documentation (3 hours)

**Before v1.0 (24 hours):**
- RLS policies (4 hours)
- Docker setup (2 hours)
- Monitoring (4 hours)
- E2E coverage (8 hours)
- Performance testing (6 hours)

---

**TOTAL TIME TO PRODUCTION-READY:** 2-3 business days  
**TOTAL TIME TO v1.0 POLISH:** ~40 hours (1 week)

Audit: REVIEW_COMPLETE_2026-06-19_AUTOMATED.md
