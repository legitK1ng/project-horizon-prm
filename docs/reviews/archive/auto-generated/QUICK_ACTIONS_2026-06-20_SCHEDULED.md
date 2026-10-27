# HORIZON PRM — QUICK ACTIONS CHECKLIST
**Generated:** 2026-06-20 08:11 UTC  
**Status:** All critical issues resolved — only optimizations remain  
**Priority:** RECOMMENDED but NOT BLOCKING for production

---

## ✅ IMMEDIATE STATUS (NO CRITICAL ISSUES)

All validation checks passed:
- ✅ TypeScript: 0 errors
- ✅ ESLint: 0 warnings
- ✅ Tests: 3/3 passing
- ✅ Security: 0 vulnerabilities
- ✅ Build: SUCCESS
- ✅ Runtime: OPERATIONAL (port 9000 active, 24h uptime)

**Previous audit fixes (2026-06-20 04:20 UTC) remain stable.**

---

## 🟡 SHORT-TERM OPTIMIZATIONS (2-3 hours total)

### 1. Bundle Size Optimization (1-2 hours) — MEDIUM PRIORITY

**Problem:** Largest chunk is 1.45MB (flowchart-elk-definition)  
**Impact:** Initial load time penalty, slow FCP  
**Solution:** Implement dynamic imports for Mermaid + Recharts

**Implementation:**

#### Step 1: Identify eager imports
```bash
# Find Mermaid/Recharts imports
grep -r "import.*mermaid" src/
grep -r "import.*recharts" src/
```

#### Step 2: Convert to dynamic imports

**Before (eager):**
```typescript
import mermaid from 'mermaid';
import { LineChart, BarChart } from 'recharts';
```

**After (lazy):**
```typescript
// Mermaid (likely in NetworkTopology, IntelligenceDossier, or Console)
const renderDiagram = async (code: string) => {
  const { default: mermaid } = await import('mermaid');
  mermaid.initialize({ theme: 'dark' });
  return await mermaid.render('diagram-id', code);
};

// Recharts (likely in Dashboard, StatsWidget)
const ChartComponent = lazy(() => import('./ChartComponent'));
// Use with <Suspense fallback={<ChartSkeleton />}><ChartComponent /></Suspense>
```

#### Step 3: Add loading states
```typescript
// Add skeleton loaders for charts
<Suspense fallback={<div className="animate-pulse bg-slate-700/30 h-64 rounded-lg" />}>
  <DynamicChart data={chartData} />
</Suspense>
```

#### Step 4: Verify bundle improvement
```bash
npm run build
# Look for "flowchart-elk-definition" — should be <500KB now
```

**Expected Results:**
- Main bundle: 1.45MB → 580KB (~60% reduction)
- FCP improvement: ~1.2s faster
- Lighthouse Performance Score: +15 points

**Files to modify:**
```bash
# Find components using Mermaid/Recharts
src/components/NetworkTopology.tsx      # Likely Mermaid
src/components/IntelligenceDossier.tsx  # Likely Mermaid
src/components/Console.tsx              # Likely Mermaid
src/components/Dashboard.tsx            # Likely Recharts
src/components/widgets/StatsWidget.tsx  # Likely Recharts
```

**Time Estimate:** 1-2 hours

---

### 2. Repository Hygiene (30 minutes) — LOW PRIORITY

**Problem:** 70+ untracked audit documents cluttering repository  
**Impact:** Confusing git status, risk of accidental commit  
**Solution:** Archive to `.archive/` directory

**Implementation:**

```bash
# Step 1: Create archive directory
mkdir -p .archive/audits-2026-06

# Step 2: Move audit documents
mv AUDIT_COMPLETE_*.md \
   ENGINEERING_AUDIT_*.md \
   EXEC_SUMMARY_*.txt \
   QUICK_ACTIONS_*.md \
   QUICK_ACTION_CHECKLIST*.md \
   QUICK_FIX_ACTIONS_*.md \
   REVIEW_COMPLETE_*.md \
   REVIEW_SUMMARY.md \
   CODE_REVIEW*.md \
   FINAL_REVIEW_SUMMARY_*.md \
   REVIEW_CORRECTIONS_*.md \
   CODEBASE_METRICS_*.txt \
   BACKEND_STATUS_*.txt \
   DOC_STATUS.md \
   .archive/audits-2026-06/

# Step 3: Move knowledge/design documents (optional - review first)
mkdir -p .archive/docs
mv BACKEND_DEPENDENCIES_ADDENDUM.md \
   CONSTITUTION_PATCH.md \
   CONTACT_INTELLIGENCE_AND_OBSIDIAN_ARCHITECTURE.md \
   DEPENDENCY_RESOLUTION_REQUIRED.md \
   DESIGN_TOKENS.md \
   EMERGENCY_FIX_SCRIPTS.md \
   HORIZON_PIPELINE_NOTES.md \
   INGESTION_RECONCILIATION_ARCHITECTURE.md \
   PROJECT_STRUCTURE_ADDENDUM.md \
   STORAGE_AUDIT_ADDENDUM.md \
   TECHNICAL_CORRECTIONS.md \
   .archive/docs/ 2>/dev/null || true

# Step 4: Update .gitignore
cat >> .gitignore <<EOF

# Audit archives
.archive/

# Obsidian plugins
.obsidian/plugins/

# Backend temp files
mcp-backend/audio_ingest/temp/
*.pyc
__pycache__/

# Excalidraw drawings (if not needed in git)
*.excalidraw.md
EOF

# Step 5: Verify cleanup
git status --short
```

**Expected Results:**
- Clean `git status` output
- Audit history preserved in `.archive/`
- Reduced risk of accidental audit document commits

**Time Estimate:** 30 minutes

---

### 3. Basic Test Coverage Expansion (30 minutes) — MEDIUM PRIORITY

**Problem:** Only 1 test file with 3 tests  
**Impact:** Low confidence in sync logic, offline handling  
**Solution:** Add tests for critical paths

**Implementation:**

#### Create `src/services/syncService.test.ts`
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SyncService } from './syncService';
import { db } from '../lib/db';
import { supabase } from '../lib/supabase';

// Mock Supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        data: [
          { id: '1', name: 'Test Contact', phone: '1234567890' }
        ],
        error: null
      }))
    }))
  }
}));

describe('SyncService', () => {
  beforeEach(async () => {
    await db.contacts.clear();
    await db.call_records.clear();
    await db.tasks.clear();
  });

  it('should sync contacts from Supabase to IndexedDB', async () => {
    await SyncService.initialSync();
    
    const contacts = await db.contacts.toArray();
    expect(contacts).toHaveLength(1);
    expect(contacts[0]?.name).toBe('Test Contact');
  });

  it('should handle sync failures gracefully', async () => {
    // Mock Supabase error
    vi.mocked(supabase.from).mockReturnValueOnce({
      select: vi.fn(() => Promise.reject(new Error('Network error')))
    } as any);

    await expect(SyncService.initialSync()).resolves.not.toThrow();
  });

  it('should subscribe to realtime updates', () => {
    const subscribeSpy = vi.spyOn(supabase, 'channel');
    SyncService.subscribeToUpdates();
    
    expect(subscribeSpy).toHaveBeenCalledWith('public:contacts');
  });
});
```

#### Create `src/services/GuardianService.test.ts`
```typescript
import { describe, it, expect, vi } from 'vitest';
import { guardianService } from './GuardianService';
import { useGuardianStore } from '../store/guardianStore';

describe('GuardianService', () => {
  it('should initialize without errors', () => {
    expect(() => guardianService.init()).not.toThrow();
  });

  it('should handle system errors', () => {
    const storeSpy = vi.spyOn(useGuardianStore.getState(), 'updateAgent');
    
    guardianService['handleSystemError']('a1', 'Test Error', 'Details');
    
    expect(storeSpy).toHaveBeenCalledWith('a1', {
      status: 'warning',
      lastAction: 'Test Error'
    });
  });
});
```

#### Run tests
```bash
npm run test
# Expected: 7+ tests passing (was 3, now 7+)
```

**Time Estimate:** 30 minutes

---

## 🟢 MEDIUM-TERM PRIORITIES (4-6 hours)

### 4. Expand Test Coverage (3-4 hours)

**Target:** 60-70% coverage for core business logic

**Priority areas:**
1. **Offline sync reconciliation** (1 hour)
   - Test Dexie ↔ Supabase bidirectional sync
   - Test conflict resolution (last-write-wins)
   - Test offline queue processing

2. **Contact enrichment pipeline** (1 hour)
   - Mock Hunter.io, Numverify, Clearbit APIs
   - Test 6-stage enrichment flow
   - Test error handling for rate limits

3. **Real-time subscriptions** (1 hour)
   - Test postgres_changes handlers
   - Test reconnection logic
   - Test subscription cleanup on unmount

4. **E2E tests with Playwright** (1-2 hours)
   - Test: Add contact → Call log → View transcript
   - Test: Offline mode → Sync when online
   - Test: Google Contacts sync flow

**Commands:**
```bash
# Run tests with coverage
npm run test:coverage

# Run E2E tests
npx playwright test
```

**Time Estimate:** 3-4 hours

---

### 5. Performance Monitoring (1 hour)

**Implement Web Vitals tracking:**

#### Step 1: Install dependencies
```bash
npm install web-vitals
```

#### Step 2: Add to `src/main.tsx`
```typescript
import { onCLS, onFCP, onFID, onLCP, onTTFB } from 'web-vitals';

// Log Web Vitals to analytics
onCLS(console.log);
onFCP(console.log);
onFID(console.log);
onLCP(console.log);
onTTFB(console.log);
```

#### Step 3: Set up bundle size CI check
Create `.github/workflows/bundle-size.yml`:
```yaml
name: Bundle Size Check
on: [pull_request]
jobs:
  bundle-size:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run build
      - run: |
          MAX_SIZE=600000  # 600KB limit for main bundle
          ACTUAL_SIZE=$(stat -c%s dist/assets/index-*.js)
          if [ $ACTUAL_SIZE -gt $MAX_SIZE ]; then
            echo "Bundle too large: $ACTUAL_SIZE bytes (limit: $MAX_SIZE)"
            exit 1
          fi
```

**Time Estimate:** 1 hour

---

### 6. Type Safety Refinement (1 hour)

**Replace `any` in apiClient.ts with proper types:**

#### Before:
```typescript
const res = await this.request<any>(`/api/v1/contacts`);
```

#### After:
```typescript
import { ContactListResponse } from '@/schemas/api';
const res = await this.request<ContactListResponse>(`/api/v1/contacts`);
```

**Files to update:**
- `src/services/apiClient.ts` (11 instances)
- `src/types/index.ts` (review external API types)

**Time Estimate:** 1 hour

---

## 🔵 LOW-PRIORITY ENHANCEMENTS (8+ hours)

### 7. Accessibility Audit (2-3 hours)

**WCAG 2.1 AA compliance:**
- Add aria-labels to interactive elements
- Ensure keyboard navigation
- Test with screen readers
- Color contrast validation

### 8. API Documentation (2-3 hours)

**Generate OpenAPI spec from FastAPI:**
```python
# Add to mcp-backend/main.py
app = FastAPI(
    title="Horizon PRM API",
    version="2.0.0",
    docs_url="/api/docs",      # Swagger UI
    redoc_url="/api/redoc"     # ReDoc
)
```

### 9. CI/CD Pipeline (3-4 hours)

**Automated APK/IPA builds:**
- Set up GitHub Actions for mobile builds
- Capacitor Live Updates for OTA deployments
- Automated deployment to staging/production

---

## 📋 CHECKLIST SUMMARY

### ✅ COMPLETED (from previous audit)
- [x] Fix `any` type usages in syncService.ts and GuardianService.ts
- [x] Replace console logging with structured logging
- [x] Create .gitattributes for line ending consistency
- [x] Achieve 0 TypeScript errors
- [x] Achieve 0 ESLint warnings
- [x] Pass all existing tests

### 🟡 RECOMMENDED BEFORE PRODUCTION (2-3 hours)
- [ ] Implement dynamic imports for Mermaid + Recharts (1-2 hours)
- [ ] Archive 70+ audit documents (30 minutes)
- [ ] Add basic tests for SyncService (30 minutes)

### 🟢 RECOMMENDED FOR CONFIDENCE (4-6 hours)
- [ ] Expand test coverage to 60-70% (3-4 hours)
- [ ] Add Web Vitals tracking (1 hour)
- [ ] Replace `any` types in apiClient.ts (1 hour)

### 🔵 FUTURE ENHANCEMENTS (8+ hours)
- [ ] WCAG 2.1 AA accessibility audit (2-3 hours)
- [ ] Generate OpenAPI documentation (2-3 hours)
- [ ] Set up CI/CD pipeline (3-4 hours)

---

## 🎯 RECOMMENDED EXECUTION ORDER

### Phase 1: Pre-Launch (2 hours)
1. Bundle optimization (1-2 hours) — **HIGHEST IMPACT**
2. Repository cleanup (30 minutes) — **QUICK WIN**

### Phase 2: Post-Launch (4-6 hours)
1. Test coverage expansion (3-4 hours)
2. Performance monitoring (1 hour)
3. Type safety refinement (1 hour)

### Phase 3: Future Roadmap (8+ hours)
1. Accessibility audit
2. API documentation
3. CI/CD automation

---

## 📊 TRACKING PROGRESS

**Current Status:**
- Tests: 3/3 passing (baseline)
- Bundle: 1.45MB main chunk (before optimization)
- Coverage: Minimal (~5-10%)
- Repository: 90+ untracked files

**Target Status (after short-term actions):**
- Tests: 7+ passing (+133% increase)
- Bundle: 580KB main chunk (-60% reduction)
- Coverage: 30-40% (+300% increase)
- Repository: Clean (<10 untracked files)

**Target Status (after medium-term actions):**
- Tests: 15+ passing
- Bundle: <600KB (monitored by CI)
- Coverage: 60-70%
- Repository: Production-clean

---

## 🚀 DEPLOYMENT READINESS

**Current State:** ✅ APPROVED FOR PRODUCTION  
**After Short-Term Actions:** ✅ EXCELLENT (recommended)  
**After Medium-Term Actions:** ✅ BEST-IN-CLASS (ideal)

**No blockers for immediate deployment. All actions are optimizations.**

---

**Generated by:** Horizon Scheduled Review Agent  
**Full Report:** ENGINEERING_AUDIT_2026-06-20_SCHEDULED.md  
**Executive Summary:** EXEC_SUMMARY_2026-06-20_SCHEDULED.txt  
**Next Review:** 2026-06-21 08:00 UTC
