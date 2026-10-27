# HORIZON PRM — QUICK ACTION CHECKLIST
**Generated**: 2026-06-19 13:15 UTC  
**Audit**: Automated 24hr Code Review

---

## 🔴 CRITICAL (Fix Before Production)

### 1. Fix Test Configuration Conflict ⏱️ 1 hour
**File**: `vitest.config.ts`

```typescript
// Add exclude rule to prevent Playwright test pickup
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/utils/testUtils.ts',
    exclude: ['**/tests/**', '**/node_modules/**'],  // ← ADD THIS LINE
  },
});
```

**Impact**: Unblocks CI/CD pipeline, allows Playwright tests to run

---

### 2. Fix API Test Mocks ⏱️ 2 hours
**File**: `src/utils/testUtils.ts`

**Current Issue**: Mock returns `undefined` for `totalContacts`

```typescript
// Add to mockFetch function
if (url.includes('/api/v1/system/stats')) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      totalContacts: 42,       // ← ADD
      totalCalls: 15,          // ← ADD
      activeStreams: 2,        // ← ADD
      systemHealth: 'healthy'  // ← ADD
    }),
  });
}
```

**Test Command**: `npm run test` (should pass after fix)

---

### 3. Verify Whisper Model in Production ⏱️ 30 min

**Current Status**: `whisper_ready: false` in health check

**Action**:
1. Check `.env` for `HUGGINGFACE_TOKEN`
2. Verify model acceptance at https://huggingface.co/pyannote/speaker-diarization-3.1
3. Test transcription endpoint:
```bash
curl -X POST http://localhost:9000/api/v1/calls/ingest \
  -H "Authorization: Bearer $VITE_HZN_API_KEY" \
  -F "audio=@test.m4a"
```

---

## 🟡 HIGH PRIORITY (Next Sprint)

### 4. Fix Tailwind Absolute Paths ⏱️ 15 min
**File**: `tailwind.config.js`

```javascript
// BEFORE (❌ absolute path)
content: [
  'C:/Users/owner/Desktop/horizon/index.html',
  'C:/Users/owner/Desktop/horizon/src/**/*.{js,ts,jsx,tsx}',
],

// AFTER (✅ relative path)
content: [
  './index.html',
  './src/**/*.{js,ts,jsx,tsx}',
],
```

---

### 5. Accessibility Audit Setup ⏱️ 1 week

**Install**:
```bash
npm install --save-dev eslint-plugin-jsx-a11y @axe-core/react
```

**ESLint Config** (add to `eslint.config.js`):
```javascript
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default [
  {
    plugins: { 'jsx-a11y': jsxA11y },
    rules: {
      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/aria-props': 'error',
      'jsx-a11y/aria-role': 'error',
      'jsx-a11y/role-has-required-aria-props': 'error',
    },
  },
];
```

**Priority Files** (14 ARIA attributes found, needs 100+):
- `src/components/ContactList.tsx`
- `src/components/widgets/ContactsWidget.tsx`
- `src/components/common/TranscriptView.tsx`

---

### 6. Reduce TypeScript `any` Usage ⏱️ 1 week

**Hotspots**:
- `src/services/apiClient.ts` (33 instances)
- `src/types/index.ts` (7 instances)

**Strategy**:
1. Generate types from FastAPI schema:
```bash
cd mcp-backend
python -c "from main import app; import json; print(json.dumps(app.openapi()))" > openapi.json
npx openapi-typescript openapi.json --output src/types/api-schema.ts
```

2. Replace `any` with generated types:
```typescript
// BEFORE
const data: any = await response.json();

// AFTER
import type { ContactResponse } from '@/types/api-schema';
const data: ContactResponse = await response.json();
```

---

## 🟢 MEDIUM PRIORITY (Post-Launch)

### 7. Replace console.log with Structured Logger ⏱️ 3 days

**Create**: `src/utils/logger.ts`
```typescript
export const logger = {
  info: (msg: string, meta?: Record<string, any>) => {
    if (import.meta.env.DEV) {
      console.log(JSON.stringify({ 
        level: 'info', 
        msg, 
        ...meta, 
        ts: new Date().toISOString() 
      }));
    }
  },
  error: (msg: string, meta?: Record<string, any>) => {
    console.error(JSON.stringify({ 
      level: 'error', 
      msg, 
      ...meta, 
      ts: new Date().toISOString() 
    }));
  },
};
```

**Affected Files** (24 console.log instances):
- Run: `grep -r "console.log" src/ --include="*.ts" --include="*.tsx"`
- Replace all with `logger.info()` or `logger.error()`

---

### 8. Add Backend Caching Layer ⏱️ 1 week

**Why**: No caching detected; scalability at high load

**Tech Stack**: Redis + `fastapi-cache2`

```bash
pip install fastapi-cache2[redis]
```

**Implementation** (`mcp-backend/main.py`):
```python
from fastapi_cache import FastAPICache
from fastapi_cache.backends.redis import RedisBackend
from redis import asyncio as aioredis

@asynccontextmanager
async def lifespan(app: FastAPI):
    redis = aioredis.from_url("redis://localhost:6379")
    FastAPICache.init(RedisBackend(redis), prefix="horizon-cache")
    yield

@router.get("/contacts")
@cache(expire=300)  # 5-minute cache
async def get_contacts():
    # ...
```

---

## 📊 CURRENT STATUS SUMMARY

| Metric | Status | Target | Action |
|--------|--------|--------|--------|
| **Security Vulnerabilities** | ✅ 0 | 0 | Maintain |
| **ESLint Errors** | ✅ 0 | 0 | Maintain |
| **TypeScript Errors** | ✅ 0 | 0 | Maintain |
| **Test Coverage** | 🔴 <5% | 80% | Add unit tests |
| **Accessibility (ARIA)** | 🔴 14 attrs | 100+ | Implement audit |
| **TypeScript `any`** | 🟡 57 | <10 | Gradual migration |
| **Console.log** | 🟡 24 | 0 | Structured logger |
| **Build Size** | ✅ 5.5MB | <10MB | OK (optimize mermaid lazy-load) |
| **Build Time** | ✅ 2m 9s | <3min | OK |

---

## ✅ COMPLETED (Already Production-Ready)

- ✅ FastAPI backend with structured logging
- ✅ Rate limiting (120 rpm)
- ✅ CORS configuration
- ✅ Tailwind theme system (Dusk Horizon)
- ✅ Capacitor mobile integration
- ✅ Dexie IndexedDB local-first storage
- ✅ React Query caching
- ✅ Error boundaries
- ✅ Lazy route loading
- ✅ AES-256-GCM encryption

---

**Next Review**: After test coverage improvements (ETA: 1 week)
