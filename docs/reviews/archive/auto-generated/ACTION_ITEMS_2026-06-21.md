# Action Items - Engineering Review
**Generated:** 2026-06-21 01:11 UTC  
**Priority Levels:** 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low

---

## 🟠 HIGH PRIORITY (Address Before Next Deployment)

### 1. Resolve NPM Security Vulnerabilities
**Status:** ⚠️ BLOCKED by peer dependency conflict  
**Issue:** 5 moderate vulnerabilities, auto-fix failed due to ESLint v9/v10 mismatch  
**Root Cause:** capacitor-horizon uses ESLint 8, main project uses ESLint 9/10

**Action Steps:**
```bash
# Option A: Update capacitor-horizon (Recommended)
cd capacitor-horizon
npm install --save-dev eslint@^9.0.0
cd ..
npm audit fix

# Option B: Temporary workaround
npm audit fix --legacy-peer-deps

# Option C: Manual resolution
npm audit --json > audit-report.json
# Review and manually update vulnerable packages
```

**Effort:** 1 hour  
**Risk if Delayed:** Medium (moderate vulnerabilities, not critical)

---

### 2. Decide on Unstaged Files Commit Strategy
**Status:** ⏳ PENDING DECISION  
**Count:** 45+ files unstaged

**Files Requiring Decision:**

**Documentation (Safe to Commit):**
- COMPREHENSIVE_ENGINEERING_REVIEW_*.md (4 files)
- REVIEW_SUMMARY_*.md (4 files)
- Technical documents (CONSTITUTION_PATCH.md, STORAGE_AUDIT_ADDENDUM.md, etc.)

**Temporary Files (Do Not Commit):**
- mcp-backend/audio_ingest/temp/*.wav
- .obsidian/workspace.json (user-specific)

**Core Files (Review and Commit):**
- src/services/GuardianService.ts
- src/services/syncService.ts
- src/utils/testUtils.ts
- vitest.config.ts
- package.json, package-lock.json
- .env.example

**Recommended Commands:**
```bash
# Stage core service files
git add src/services/GuardianService.ts
git add src/services/syncService.ts
git add src/utils/testUtils.ts
git add vitest.config.ts

# Stage package changes
git add package.json package-lock.json

# Stage documentation (selective)
git add .env.example .gitignore .gitattributes

# Review and commit
git status
git commit -m "feat: enhance GuardianService and SyncService with improved error handling and testing infrastructure"

# Add .gitignore entries for temp files
echo "mcp-backend/audio_ingest/temp/*.wav" >> .gitignore
echo ".obsidian/workspace.json" >> .gitignore
git add .gitignore
git commit -m "chore: ignore temp audio files and Obsidian workspace"
```

**Effort:** 15 minutes  
**Impact:** Clean git status, proper version control

---

## 🟡 MEDIUM PRIORITY (Next Sprint - This Week)

### 3. Replace console.log with Structured Logging
**Status:** 📝 TODO  
**Count:** 22 occurrences across 15 files  
**Impact:** Code quality, production readiness

**Files to Update:**
```typescript
// High-priority files:
- src/components/CallLog.tsx (1)
- src/components/Dashboard.tsx (1)
- src/services/transcriptionClient.ts (2)
- src/hooks/usePipelineEvents.ts (2)
- src/components/common/GoogleSyncButton.tsx (2)
- src/components/Lab.tsx (2)

// Pattern to replace:
// Before:
console.log('Event received:', event);
console.error('Failed to fetch:', error);

// After:
import { connectionLogger } from '@/utils/connectionLogger';
connectionLogger.addLog('info', 'COMPONENT', 'EventHandler', 'Event received', { event });
connectionLogger.addLog('error', 'COMPONENT', 'Fetch', 'Failed to fetch', { error });
```

**Effort:** 30 minutes  
**Benefit:** Professional logging, easier debugging, production-ready

---

### 4. Eliminate `any` Types
**Status:** 📝 TODO  
**Count:** 12 occurrences across 6 files  
**Impact:** Type safety, developer experience

**Files to Update:**

**Priority 1: API Responses**
```typescript
// src/hooks/useHorizonData.ts:145
// Before:
mutationFn: ({ id, data }: { id: string; data: any }) => api.updateCall(id, data)

// After:
import { CallRecordUpdate } from '@/types';
mutationFn: ({ id, data }: { id: string; data: CallRecordUpdate }) => api.updateCall(id, data)
```

**Priority 2: Component Results**
```typescript
// src/components/Dashboard.tsx:83
// Before:
const result: any = await syncContacts.mutateAsync(...)

// After:
import { SyncResult } from '@/types';
const result: SyncResult = await syncContacts.mutateAsync(...)
```

**Action Steps:**
1. Define missing types in src/types/index.ts
2. Update function signatures in src/services/apiClient.ts
3. Replace `any` with proper interfaces
4. Run `npm run type-check` to verify

**Effort:** 1 hour  
**Benefit:** Better IntelliSense, compile-time error detection, safer refactoring

---

### 5. Add Critical Service Tests
**Status:** 📝 TODO  
**Current Coverage:** 3 tests (baseline)  
**Target:** 20+ tests covering critical paths

**Test Files to Create:**

**GuardianService.test.ts**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { guardianService } from './GuardianService';
import { useGuardianStore } from '@/store/guardianStore';

describe('GuardianService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize only once', () => {
    guardianService.init();
    guardianService.init();
    // Verify initialization logic runs once
  });

  it('should detect Supabase connection failure', async () => {
    // Mock Supabase failure
    // Verify agent status changes to 'warning'
    // Verify error log is created
  });

  it('should restore agent status after recovery', async () => {
    // Mock Supabase failure then recovery
    // Verify mission 'REPAIR' is executed
  });
});
```

**SyncService.test.ts**
```typescript
import { describe, it, expect, vi } from 'vitest';
import { SyncService } from './syncService';
import { db } from '@/lib/db';

describe('SyncService', () => {
  it('should fetch and bulk insert contacts on initial sync', async () => {
    // Mock Supabase response
    // Verify db.contacts.bulkPut called
  });

  it('should handle realtime INSERT events', async () => {
    // Mock Realtime channel event
    // Verify db.contacts.put called
  });

  it('should handle realtime DELETE events', async () => {
    // Mock Realtime DELETE event
    // Verify db.contacts.delete called
  });
});
```

**Effort:** 2 hours (1 hour per service)  
**Benefit:** Regression prevention, safer refactoring, deployment confidence

---

### 6. Update Python Dependencies
**Status:** 📝 TODO  
**Impact:** Security patches, performance improvements

**Packages to Update:**
```bash
cd mcp-backend
venv\Scripts\python.exe -m pip install --upgrade \
  aiohappyeyeballs \
  aiohttp \
  anyio \
  attrs \
  av \
  beautifulsoup4 \
  cachetools \
  certifi \
  charset-normalizer
```

**Effort:** 5 minutes  
**Risk:** Low (patch-level updates only)

---

## 🟢 LOW PRIORITY (Next Month)

### 7. Expand Test Coverage to 60%+
**Status:** 📝 TODO  
**Current:** ~10% (estimated)  
**Target:** 60%+

**Test Categories Needed:**
- Component integration tests (React Testing Library)
- E2E tests (Playwright)
- Mobile workflow tests (Capacitor)
- Performance tests (virtual scrolling, rendering)

**Effort:** 2-3 days  
**Benefit:** Production-grade quality assurance

---

### 8. Add Accessibility Audit
**Status:** 📝 TODO  
**Tools:** axe-core, eslint-plugin-jsx-a11y

**Action Steps:**
```bash
npm install --save-dev \
  eslint-plugin-jsx-a11y \
  @axe-core/react

# Add to ESLint config
# Run accessibility audit
npm run lint:a11y
```

**Effort:** 1 day  
**Benefit:** WCAG 2.1 compliance, broader user reach

---

### 9. Implement Offline Mutation Queue
**Status:** 💡 ENHANCEMENT  
**Current:** Real-time sync only works when online  
**Proposed:** Queue mutations when offline, sync when reconnected

**Implementation:**
```typescript
// src/lib/offlineQueue.ts
export class OfflineQueue {
  async addMutation(mutation: Mutation) {
    await db.offline_queue.add(mutation);
  }

  async processPendingMutations() {
    const pending = await db.offline_queue.toArray();
    for (const mutation of pending) {
      await this.applyMutation(mutation);
      await db.offline_queue.delete(mutation.id);
    }
  }
}
```

**Effort:** 2 days  
**Benefit:** True offline-first experience, no data loss

---

### 10. Performance Profiling
**Status:** 💡 OPTIMIZATION  
**Tools:** Chrome DevTools, React DevTools Profiler

**Metrics to Measure:**
- ContactList render time (10k contacts)
- Time to Interactive (TTI)
- Largest Contentful Paint (LCP)
- First Input Delay (FID)

**Effort:** 1 day  
**Benefit:** Identify bottlenecks, optimize bundle size

---

## 📊 Progress Tracking

| Priority | Total Items | Completed | In Progress | TODO |
|----------|-------------|-----------|-------------|------|
| 🔴 Critical | 0 | 0 | 0 | 0 |
| 🟠 High | 2 | 0 | 0 | 2 |
| 🟡 Medium | 4 | 0 | 0 | 4 |
| 🟢 Low | 4 | 0 | 0 | 4 |
| **Total** | **10** | **0** | **0** | **10** |

---

## 🎯 Success Criteria

### Week 1 (Current Sprint)
- [ ] NPM security vulnerabilities resolved
- [ ] Git status clean (all files committed or ignored)
- [ ] Console.log replaced with structured logging
- [ ] `any` types eliminated

### Week 2-4 (Next Month)
- [ ] GuardianService tests added
- [ ] SyncService tests added
- [ ] Python dependencies updated
- [ ] Test coverage >30%

### Month 2-3 (Next Quarter)
- [ ] E2E test suite implemented
- [ ] Accessibility audit passing
- [ ] Offline mutation queue working
- [ ] Performance optimized (TTI <2s)

---

## 📝 Notes

### ESLint Peer Dependency Conflict Details
```
Conflict:
- Main project: @eslint/js@10.0.1 requires eslint@^10.0.0
- capacitor-horizon: Uses eslint@^8.57.1

Resolution Options:
1. Update capacitor-horizon to ESLint 9+ (breaking change)
2. Use --legacy-peer-deps (temporary workaround)
3. Pin @eslint/js to v9.x compatible version
```

### Test Coverage Priority
```
Critical Path Coverage:
1. GuardianService health checks (core monitoring)
2. SyncService bidirectional sync (data integrity)
3. ContactList virtual scrolling (performance)
4. Auth flow (security)

Secondary Coverage:
- UI components (React Testing Library)
- API client (integration tests)
- Mobile workflows (E2E with Playwright)
```

---

**Report Generated:** 2026-06-21 01:11 UTC  
**Next Review:** 2026-06-22 01:11 UTC  
**Auto-Generated by:** Autonomous Engineering Review Agent
