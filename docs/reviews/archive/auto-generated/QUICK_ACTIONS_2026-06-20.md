# ⚡ HORIZON PRM — QUICK ACTIONS REQUIRED
**Generated:** 2026-06-20 04:15 UTC  
**Priority:** IMMEDIATE → SHORT-TERM → LONG-TERM

---

## 🔴 IMMEDIATE (Before Next Commit)

### 1. Fix Type Safety Issues (15 minutes)
**Files:** `src/services/syncService.ts`, `src/services/GuardianService.ts`

#### syncService.ts Lines 31, 40
```typescript
// ❌ CURRENT
await db.contacts.put(payload.new as any);
await db.call_records.put(payload.new as any);

// ✅ FIX
import { Contact, CallRecord } from '@/types';
await db.contacts.put(payload.new as Contact);
await db.call_records.put(payload.new as CallRecord);
```

#### GuardianService.ts Lines 34, 49, 76
```typescript
// ❌ CURRENT
} catch (err: any) {
private analyzeError(log: any) {
status: action.toLowerCase() as any,

// ✅ FIX
} catch (err: unknown) {
  const error = err as Error;
  this.handleSystemError('a1', 'Supabase Offline', error.message);
}

private analyzeError(log: { type: string; message: string; url?: string }) {

type AgentStatus = 'idle' | 'warning' | 'scanning' | 'repairing' | 'optimizing' | 'guardian';
status: action.toLowerCase() as AgentStatus,
```

### 2. Replace Console Logging (5 minutes)
**File:** `src/services/syncService.ts` Lines 19-21

```typescript
// ❌ CURRENT
console.log('Initial sync complete.');
console.error('Error during initial sync:', error);

// ✅ FIX
import { connectionLogger } from '@/utils/connectionLogger';
connectionLogger.addLog('success', 'SYNC', 'SYSTEM', 'Initial sync complete');
connectionLogger.addLog('error', 'SYNC', 'SYSTEM', 'Initial sync failed', { error });
```

### 3. Add .gitattributes (2 minutes)
**File:** `.gitattributes` (create new)

```gitattributes
* text=auto eol=lf
*.{cmd,bat} text eol=crlf
```

### 4. Clean Repository Hygiene (30 minutes)
**Action:** Archive or delete 70+ obsolete audit documents

```bash
# Move to archive folder
mkdir -p archive/audits-2026-06
mv AUDIT_COMPLETE_2026-06-19*.md archive/audits-2026-06/
mv EXEC_SUMMARY_2026-06-19*.txt archive/audits-2026-06/
mv ENGINEERING_AUDIT_2026-06-19*.md archive/audits-2026-06/
mv QUICK_ACTION_CHECKLIST_2026-06-19*.md archive/audits-2026-06/
mv REVIEW_COMPLETE_2026-06-19*.md archive/audits-2026-06/

# Or delete if not needed
git clean -n  # Preview
git clean -f  # Execute (use with caution)
```

---

## 🟡 SHORT-TERM (Before Production)

### 5. Implement Bundle Code-Splitting (1-2 hours)
**Target:** Reduce largest chunks from 1.45MB → <500KB

#### Dynamic Imports for Heavy Libraries
**Files to modify:**
- `src/components/Dashboard.tsx`
- `src/components/NetworkTopology.tsx`
- Any component using Mermaid or Recharts

**Example:**
```typescript
// Before: Bundled in main chunk
import mermaid from 'mermaid';
import { LineChart } from 'recharts';

// After: Lazy-load when needed
const MermaidDiagram = lazy(() => import('./MermaidDiagram'));
const ChartComponent = lazy(() => import('./ChartComponent'));
```

### 6. Expand Test Coverage to 70%+ (2-3 hours)
**Priority Files:**
1. `src/services/syncService.ts` — Test offline sync reconciliation
2. `src/services/GuardianService.ts` — Test health monitoring logic
3. `src/components/ContactList.tsx` — Test virtualization edge cases
4. `src/services/apiClient.ts` — Test API error handling

**Example Test (syncService.test.ts):**
```typescript
import { describe, it, expect, vi } from 'vitest';
import { SyncService } from './syncService';
import { db } from '@/lib/db';
import { supabase } from '@/lib/supabase';

describe('SyncService', () => {
  it('should sync contacts from Supabase to Dexie', async () => {
    // Mock Supabase response
    const mockContacts = [{ id: '1', first_name: 'Test' }];
    vi.spyOn(supabase.from('contacts'), 'select').mockResolvedValue({ data: mockContacts });
    
    await SyncService.initialSync();
    
    const localContacts = await db.contacts.toArray();
    expect(localContacts).toHaveLength(1);
    expect(localContacts[0].first_name).toBe('Test');
  });
});
```

### 7. Set Up Bundle Size Monitoring (30 minutes)
```bash
npm install --save-dev bundlesize

# Add to package.json
"bundlesize": [
  {
    "path": "./dist/assets/*.js",
    "maxSize": "500 kB",
    "compression": "gzip"
  }
]

# Add to CI pipeline
npm run bundlesize
```

### 8. Document API Endpoints (1 hour)
**Action:** Create OpenAPI/Swagger documentation for backend

**File:** `mcp-backend/openapi.yaml`
```yaml
openapi: 3.0.0
info:
  title: Horizon PRM API
  version: 2.8.0
paths:
  /api/v1/health:
    get:
      summary: Health check endpoint
      responses:
        '200':
          description: Service healthy
```

---

## 🟢 LONG-TERM (Optimization)

### 9. Implement Service Worker for PWA (4-6 hours)
**Benefit:** Offline-first, faster load times, installable app

```bash
npm install --save-dev vite-plugin-pwa
```

### 10. Set Up Lighthouse CI (2-3 hours)
**Benefit:** Automated performance regression detection

```bash
npm install --save-dev @lhci/cli

# .lighthouserc.json
{
  "ci": {
    "collect": {
      "startServerCommand": "npm run preview",
      "url": ["http://localhost:4173"]
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "categories:accessibility": ["error", { "minScore": 0.9 }]
      }
    }
  }
}
```

### 11. Add E2E Tests with Playwright (4-6 hours)
**Already Installed:** `@playwright/test@^1.58.2`

**Example Test:**
```typescript
// tests/e2e/contact-list.spec.ts
import { test, expect } from '@playwright/test';

test('should display contact list', async ({ page }) => {
  await page.goto('http://localhost:5173/contacts');
  await expect(page.locator('h2')).toContainText('Intelligence Directory');
  await expect(page.locator('.glass-premium')).toHaveCount(10); // First page
});
```

### 12. Configure CDN for Static Assets (1-2 hours)
**Options:** Cloudflare, AWS CloudFront, Vercel Edge Network

**Benefit:** Faster global asset delivery, reduced server load

---

## 📊 PROGRESS TRACKING

| Task | Priority | Est. Time | Status |
|------|----------|-----------|--------|
| Fix type safety (5 issues) | 🔴 Immediate | 15 min | ⬜ TODO |
| Replace console logging | 🔴 Immediate | 5 min | ⬜ TODO |
| Add .gitattributes | 🔴 Immediate | 2 min | ⬜ TODO |
| Clean repository | 🔴 Immediate | 30 min | ⬜ TODO |
| Bundle code-splitting | 🟡 Short-term | 1-2 hrs | ⬜ TODO |
| Expand test coverage | 🟡 Short-term | 2-3 hrs | ⬜ TODO |
| Bundle size monitoring | 🟡 Short-term | 30 min | ⬜ TODO |
| API documentation | 🟡 Short-term | 1 hr | ⬜ TODO |
| Service worker PWA | 🟢 Long-term | 4-6 hrs | ⬜ TODO |
| Lighthouse CI | 🟢 Long-term | 2-3 hrs | ⬜ TODO |
| E2E tests | 🟢 Long-term | 4-6 hrs | ⬜ TODO |
| CDN setup | 🟢 Long-term | 1-2 hrs | ⬜ TODO |

**Total Immediate Tasks:** 4 (~52 minutes)  
**Total Short-Term Tasks:** 4 (~5-8 hours)  
**Total Long-Term Tasks:** 4 (~11-17 hours)

---

**Next Review:** 2026-06-21 04:00 UTC
