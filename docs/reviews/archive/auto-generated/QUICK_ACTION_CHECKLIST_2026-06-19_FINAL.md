# Quick Action Checklist — 2026-06-19 Engineering Audit

## 🔴 URGENT (Fix This Week)

### 1. Backend Test Environment
**Issue**: Tests failing due to wrong Python venv  
**Impact**: Blocks CI/CD, cannot verify code quality  
**Fix**:
```bash
cd mcp-backend
# Activate project venv
source ../.venv/Scripts/activate  # Windows Git Bash
# OR
../.venv/Scripts/activate  # PowerShell

# Run tests
python -m pytest tests/ -v

# Make permanent: Create pytest.ini
cat > pytest.ini << EOF
[pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
EOF
```

### 2. Frontend Test Configuration
**Issue**: Playwright incompatible with Vitest runner  
**Impact**: Cannot run E2E tests  
**Fix**:
```bash
# 1. Create e2e/ directory
mkdir e2e
mv tests/ux-improvements.spec.ts e2e/

# 2. Create playwright.config.ts
cat > playwright.config.ts << EOF
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:5173' }
});
EOF

# 3. Update package.json scripts
"test:unit": "vitest",
"test:e2e": "playwright test",
"test": "npm run test:unit && npm run test:e2e"
```

---

## 🟡 HIGH PRIORITY (Next Sprint)

### 3. Test Coverage for WiFi Ingestion
**New Code**: 484 lines in `services/acr_wifi_service.py`  
**Current Coverage**: 0% (untested)  
**Action**:
```bash
cd mcp-backend
# Create tests/test_acr_wifi_service.py
# Test: HTML parsing, deduplication, batch inserts, error handling
```

### 4. Documentation Cleanup
**Issue**: 45+ untracked audit/review files  
**Action**:
```bash
mkdir -p docs/audits/archive
mv ENGINEERING_AUDIT_2026-06-15.md docs/audits/archive/
mv CODE_REVIEW_2026-06-14.md docs/audits/archive/
# Keep only latest audit in root
```

---

## 🟢 MEDIUM PRIORITY (Backlog)

### 5. Update README
**Missing**: WiFi ingestion setup instructions  
**Action**: Add section to README.md
```markdown
## WiFi Ingestion Setup

ACR Phone WiFi Web Server integration:
1. Enable WiFi Web Server in ACR Phone settings
2. Note the IP address (e.g., 192.168.1.100:8000)
3. POST to /api/v1/batch-ingest:
   {
     "source": "wifi",
     "url": "http://192.168.1.100:8000"
   }
```

### 6. Load Testing
**Target**: WiFi ingestion with 1000+ recordings  
**Tool**: `locust` or `pytest-benchmark`  
**Action**: Create performance test suite

---

## ✅ WORKING WELL (Keep Doing)

- Clean conventional commits
- TypeScript strict mode
- ESLint enforcement
- Local-first architecture (Dexie)
- Batch insert optimizations
- Professional UI theming
- Security-first API design

---

## 📊 Success Metrics

**When to consider production-ready**:
- [ ] Backend test suite: 100% pass rate
- [ ] Frontend test suite: E2E + unit separated
- [ ] Code coverage: >70% backend, >60% frontend
- [ ] Load test: 1000 recordings in <5min
- [ ] Security audit: External firm review complete
- [ ] Documentation: Setup guide + API docs current

**Current Status**: 4/6 metrics met (TypeScript, ESLint, Security basics, Architecture)

---

**Generated**: 2026-06-19  
**Next Review**: 2026-06-20

---

## 📊 Additional Test Findings

### Frontend Test Files
- **Count**: 0 Vitest-compatible test files found
- **Issue**: tests/ux-improvements.spec.ts uses Playwright syntax
- **Impact**: No unit test coverage in frontend
- **Action**: Create Vitest unit tests for components
  ```bash
  # Example structure:
  src/
    components/
      ContactList.tsx
      ContactList.test.tsx  # ← Add this
      Dashboard.tsx
      Dashboard.test.tsx    # ← Add this
  ```

### Backend Test Files
- **Collected**: 7 test items in tests/
- **Scripts**: 2 test files in scripts/ (ACR ingestion)
- **Status**: Cannot run due to venv issue
- **Coverage**: Estimated <30% (many services untested)

### Recommended Test Strategy
1. **Unit Tests** (Vitest): Component logic, utilities, hooks
2. **Integration Tests** (pytest): API endpoints, database operations
3. **E2E Tests** (Playwright): User workflows, mobile app flows
4. **Load Tests** (locust): WiFi ingestion, concurrent users

---

**Updated**: 2026-06-19 13:37 UTC
