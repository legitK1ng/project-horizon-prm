# ⚡ QUICK FIX ACTIONS — Horizon PRM
**Generated:** 2026-06-19  
**Priority:** CRITICAL PATH TO PRODUCTION

---

## 🔥 IMMEDIATE FIXES (Today — 4 hours total)

### 1. Fix Failing Unit Tests (2 hours) ❌ CRITICAL
**File:** `src/utils/testUtils.ts`

```typescript
// CURRENT (BROKEN):
export const mockFetch = async (url: string) => {
  if (url.includes('/health')) {
    return { ok: true, json: async () => ({ totalContacts: 42 }) };
  }
};

// FIX TO:
export const mockFetch = async (url: string) => {
  if (url.includes('/api/v1/data')) {
    return {
      ok: true,
      json: async () => ({
        data: {
          total_contacts: 42,
          active_contacts: 30,
          calls_this_week: 15
        }
      })
    };
  }
  if (url.includes('/api/v1/health')) {
    return {
      ok: true,
      json: async () => ({ status: 'healthy' })
    };
  }
  // Add models endpoint mock
  if (url.includes('/models')) {
    return {
      ok: true,
      json: async () => ({
        models: [{ id: 'gpt-4', name: 'GPT-4' }]
      })
    };
  }
};
```

**Verify:**
```bash
npm run test
# Expected: ✓ 3 passing
```

---

### 2. Fix Playwright Configuration (1 hour) ❌ CRITICAL
**Create:** `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/utils/testSetup.ts',
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/tests/**/*.spec.ts',  // Exclude Playwright E2E tests
      '**/.{idea,git,cache,output,temp}/**'
    ],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', 'tests/']
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
```

**Update:** `package.json` scripts
```json
{
  "scripts": {
    "test": "vitest",
    "test:e2e": "playwright test",
    "test:all": "vitest && playwright test",
    "test:coverage": "vitest --coverage"
  }
}
```

**Verify:**
```bash
npm run test       # Should run only Vitest (unit tests)
npm run test:e2e   # Should run only Playwright (E2E tests)
```

---

### 3. Run Dependency Security Audit (30 min) ⚠️ HIGH
```bash
# Frontend
npm audit --production
npm audit fix --production  # If safe fixes available

# Backend
cd mcp-backend
pip install pip-audit
pip-audit  # or: safety check
```

**Document findings** in `SECURITY_AUDIT_2026-06-19.md`

---

### 4. Commit Pending Changes (30 min) ⚠️ MEDIUM
```bash
git status --porcelain | wc -l
# Current: 63 uncommitted files

# Option A: Commit as work-in-progress
git add .
git commit -m "chore: audit baseline - docs and config updates"

# Option B: Stash for later review
git stash save "audit-baseline-2026-06-19"
```

---

## 📅 THIS WEEK FIXES (5-7 days)

### 5. Generate Core Tests (Target: 40% coverage)
**Priority Files:**
```bash
# Create test files:
touch src/components/ContactList.test.tsx
touch src/components/Dashboard.test.tsx
touch src/services/syncService.test.ts
touch src/lib/db.test.ts
```

**ContactList.test.tsx Template:**
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ContactList from './ContactList';

describe('ContactList', () => {
  it('renders contact list with search', async () => {
    render(<ContactList />);
    const searchInput = screen.getByPlaceholderText(/search/i);
    expect(searchInput).toBeDefined();
  });

  it('filters contacts by search term', async () => {
    // Test search functionality
  });

  it('sorts contacts alphabetically', () => {
    // Test sorting
  });

  it('toggles favorite status', () => {
    // Test favorite toggle
  });
});
```

**Target Coverage:**
- ContactList.tsx: 80%
- Dashboard.tsx: 70%
- SyncService.ts: 85%
- apiClient.ts: 90%

---

### 6. Code Splitting for Large Bundles
**File:** `src/App.tsx`

```typescript
import { lazy, Suspense } from 'react';

// Lazy load heavy components
const Dashboard = lazy(() => import('./components/Dashboard'));
const Lab = lazy(() => import('./components/Lab'));
const CallLog = lazy(() => import('./components/CallLog'));

// Lazy load Mermaid
const MermaidRenderer = lazy(() => import('./components/MermaidRenderer'));

function App() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/lab" element={<Lab />} />
        <Route path="/calls" element={<CallLog />} />
      </Routes>
    </Suspense>
  );
}
```

**Target:** Reduce largest chunk from 1.4 MB to <500 KB

---

### 7. Remove Console.log Statements (2 hours)
**Create:** `src/utils/logger.ts`

```typescript
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private isDev = import.meta.env.DEV;

  debug(...args: unknown[]) {
    if (this.isDev) console.log('[DEBUG]', ...args);
  }

  info(...args: unknown[]) {
    console.info('[INFO]', ...args);
  }

  warn(...args: unknown[]) {
    console.warn('[WARN]', ...args);
  }

  error(...args: unknown[]) {
    console.error('[ERROR]', ...args);
  }
}

export const logger = new Logger();
```

**Replace in 16 files:**
```bash
# Find all console.log
rg "console\.(log|warn|error)" src/ --files-with-matches

# Replace pattern:
# console.log('Sync complete') → logger.debug('Sync complete')
# console.error('Failed', err) → logger.error('Failed', err)
```

---

### 8. Fix TypeScript `any` Types (2 days)
**Priority Files (20 total):**

**src/services/apiClient.ts:**
```typescript
// Before
async getContacts(): Promise<any> {
  const res = await this.request<any>('/api/v1/contacts');
  return res.data || [];
}

// After
interface ContactsResponse {
  data: Contact[];
  total_count: number;
  has_more: boolean;
}

async getContacts(): Promise<ContactsResponse> {
  return this.request<ContactsResponse>('/api/v1/contacts');
}
```

**Strategy:**
1. Start with API client (most critical)
2. Move to hooks (useHorizonData, useSupabaseData)
3. Fix component props
4. Run `npm run type-check` after each file

---

### 9. Add Error Boundaries
**Wrap critical sections:**

```typescript
// src/App.tsx
import { ErrorBoundary } from './components/common/ErrorBoundary';

<ErrorBoundary fallback={<ErrorFallback />}>
  <ContactList />
</ErrorBoundary>

<ErrorBoundary fallback={<ErrorFallback />}>
  <Dashboard />
</ErrorBoundary>

<ErrorBoundary fallback={<ErrorFallback />}>
  <Lab />
</ErrorBoundary>
```

---

## 📊 VERIFICATION CHECKLIST

After completing fixes, verify:

```bash
# 1. All tests passing
npm run test          # ✓ All unit tests green
npm run test:e2e      # ✓ All E2E tests green

# 2. Coverage improved
npm run test:coverage # ✓ Coverage ≥40% (target: 60%)

# 3. Build successful
npm run build         # ✓ No errors, warnings acceptable

# 4. Type check clean
npm run type-check    # ✓ 0 errors

# 5. Linting clean
npm run lint          # ✓ 0 errors, 0 warnings

# 6. Security audit clean
npm audit --production # ✓ 0 critical, 0 high
pip-audit             # ✓ 0 vulnerabilities

# 7. Runtime healthy
curl http://localhost:8000/api/v1/health  # ✓ {"status":"ok"}
curl http://localhost:9000/v1/health      # ✓ {"status":"ok"}
```

---

## 🎯 SUCCESS METRICS

**Current State:**
- ❌ Tests: 0/3 passing (0%)
- ❌ Coverage: ~1.2%
- ⚠️ Bundle: 1.4 MB largest chunk
- ⚠️ Type Safety: 20 files with `any`

**Target After This Week:**
- ✅ Tests: 100% passing
- ✅ Coverage: ≥40% (stretch: 60%)
- ✅ Bundle: <500 KB per chunk
- ✅ Type Safety: <5 files with `any`

---

## 📞 HELP NEEDED?

**Stuck on a fix?** Check:
1. Full audit report: `ENGINEERING_AUDIT_2026-06-19_FINAL.md`
2. Vitest docs: https://vitest.dev/guide/
3. Playwright docs: https://playwright.dev/
4. React Testing Library: https://testing-library.com/react

**Escalation:** If any fix takes >2x estimated time, pause and document blockers.

---

**Last Updated:** 2026-06-19  
**Owner:** Development Team  
**Review Date:** 2026-06-26 (1 week)
