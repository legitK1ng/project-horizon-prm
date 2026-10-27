# HORIZON PRM — QUICK ACTION CHECKLIST
**Generated:** 2026-06-19 14:20 UTC  
**Priority:** IMMEDIATE

---

## ⚠️ CRITICAL (Do Today)

### 1. Fix Backend Test Suite (10 minutes)
**Issue:** ImportError: cannot import name 'genai' from 'google'

**Solution:**
```bash
cd mcp-backend

# Remove conflicting packages
pip uninstall google-generativeai google-genai -y

# Reinstall correct version
pip install google-genai>=1.16.0

# Verify
python -c "from google import genai; print('✅ Import OK')"

# Run tests
pytest tests/ -v --tb=short
```

**Expected Result:** Tests collect and run successfully

---

### 2. Investigate 2,713 Errored Records (30 minutes)
**Issue:** Sentinel reports 2,713 records in error state

**Solution:**
```bash
cd mcp-backend

# Run data quality audit
python data_quality_audit.py > ../data_quality_report_2026-06-19.txt

# Review the report
cat ../data_quality_report_2026-06-19.txt | head -100

# Check for common patterns
grep -i "error" ../data_quality_report_2026-06-19.txt | sort | uniq -c | sort -rn

# If WiFi ingestion related, check ACR service logs
grep -i "wifi" logs/*.log | tail -100
```

**Expected Result:** Identify error patterns (constraint violations, schema mismatches, etc.)

---

### 3. Add Frontend Test Script (2 minutes)
**Issue:** Vitest configured but no test script in package.json

**Solution:**
Edit `package.json`, add to `"scripts"`:
```json
"test": "vitest",
"test:ui": "vitest --ui",
"test:coverage": "vitest --coverage"
```

**Verify:**
```bash
npm run test -- --version
# Should output vitest version
```

---

## 🔶 HIGH PRIORITY (This Week)

### 4. Clean Up Repository (15 minutes)
**Issue:** 160+ untracked files cluttering git status

**Solution:**
Edit `.gitignore`, add:
```gitignore
# Review archives
ENGINEERING_REVIEW_*.md
AUTOMATED_REVIEW_*.md
CRITICAL_ACTIONS_REQUIRED_*.md
REVIEW_EXECUTIVE_SUMMARY*.txt
CODE_REVIEW_*.md
FINAL_REVIEW_SUMMARY_*.md

# Obsidian
.obsidian/plugins/
.obsidian/community-plugins.json
.obsidian/graph.json
.obsidian/workspace.json

# Temporary uploads
.tmp.driveupload/
.tmp.*/

# Package backups
*.backup.*
```

**Then archive old reviews:**
```bash
mkdir -p docs/review-archive
mv *REVIEW*.md *REVIEW*.txt docs/review-archive/ 2>/dev/null
git status  # Should be much cleaner
```

---

### 5. Fix Line Endings (5 minutes)
**Issue:** Git warnings about CRLF/LF conversion

**Solution:**
Create `.gitattributes` in project root:
```gitattributes
# Default to LF for all text files
* text=auto eol=lf

# Windows scripts use CRLF
*.{cmd,bat,ps1} text eol=crlf

# Binary files
*.{png,jpg,jpeg,gif,ico,mov,mp4,mp3,wav} binary
```

**Apply:**
```bash
git add .gitattributes
git rm --cached -r .
git reset --hard
git status  # No more line ending warnings
```

---

### 6. Create Smoke Tests (2 hours)
**Goal:** Basic test coverage for critical paths

**Frontend** (`src/components/ContactList.test.tsx`):
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ContactList from './ContactList';

describe('ContactList', () => {
  it('renders without crashing', () => {
    render(<ContactList />);
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
  });
});
```

**Backend** (`mcp-backend/tests/test_health.py`):
```python
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
```

**Run:**
```bash
# Frontend
npm run test

# Backend
cd mcp-backend && pytest tests/test_health.py -v
```

---

## 📋 MEDIUM PRIORITY (This Month)

### 7. Document Deployment Process
**File:** `DEPLOYMENT.md`

**Contents should include:**
- Environment setup (production vs staging)
- Database migration procedure
- API key rotation process
- Health check URLs
- Rollback procedure
- Monitoring dashboard links

---

### 8. Set Up CI/CD Pipeline
**Platform:** GitHub Actions

**File:** `.github/workflows/ci.yml`
```yaml
name: CI
on: [push, pull_request]
jobs:
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run type-check
      - run: npm run lint
      - run: npm run test
  
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - run: cd mcp-backend && pip install -r requirements.txt
      - run: cd mcp-backend && pytest tests/ -v
```

---

### 9. Implement Monitoring
**Tools:** Sentry (errors), Datadog (metrics)

**Backend** (`mcp-backend/main.py`):
```python
import sentry_sdk
sentry_sdk.init(dsn=os.environ.get("SENTRY_DSN"))
```

**Frontend** (`src/main.tsx`):
```typescript
import * as Sentry from "@sentry/react";
Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN });
```

---

### 10. Load Testing
**Tool:** k6

**Script** (`load-test.js`):
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  vus: 100,
  duration: '5m',
};

export default function () {
  let response = http.get('http://localhost:8000/api/v1/health');
  check(response, { 'status is 200': (r) => r.status === 200 });
  sleep(1);
}
```

**Run:**
```bash
k6 run load-test.js
```

**Target:** <200ms p95 latency, 0% errors

---

## 📊 COMPLETION CHECKLIST

```
Day 1:
☐ Fix backend test imports
☐ Investigate 2,713 errored records
☐ Add frontend test script
☐ Document findings

Week 1:
☐ Clean up repository (.gitignore updates)
☐ Fix line endings (.gitattributes)
☐ Create smoke tests (frontend + backend)
☐ Achieve >0% test coverage

Week 2-3:
☐ Document deployment process
☐ Set up CI/CD pipeline
☐ Implement monitoring (Sentry/Datadog)
☐ Load testing baseline

Month 1:
☐ Achieve 70%+ test coverage
☐ Security audit (OWASP ZAP)
☐ Performance optimization
☐ Production deployment readiness review
```

---

**Estimated Time Investment:**
- Day 1 (Critical): 1 hour
- Week 1: 4-6 hours
- Week 2-3: 8-12 hours
- Month 1: 20-30 hours

**Risk Reduction:** HIGH → LOW after Week 1 completion

---

**Generated by:** Automated Engineering Agent v3.0.0  
**Next Review:** 2026-06-20 14:00 UTC
