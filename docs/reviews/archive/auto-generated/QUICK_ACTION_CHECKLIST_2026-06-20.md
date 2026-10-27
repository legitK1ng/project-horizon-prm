# HORIZON PRM — QUICK ACTION CHECKLIST
## Generated: 2026-06-20

### 🔴 PRIORITY 1 — BLOCKING PRODUCTION (2-4 hours)

- [ ] **Fix Whisper Service Initialization**
  ```bash
  cd mcp-backend
  python -c "from faster_whisper import WhisperModel; WhisperModel('base')"
  # Check logs for model download errors
  # Verify HUGGINGFACE_TOKEN in mcp-backend/.env
  ```
  **Blocker:** Core transcription feature unavailable
  **Impact:** Cannot process call recordings from ACR Phone

- [ ] **Expand Test Coverage to 70%**
  - [ ] Add `GuardianService.test.ts` (health check mocking)
  - [ ] Add `SyncService.test.ts` (realtime subscription tests)
  - [ ] Add `Dashboard.test.tsx` (integration tests)
  - [ ] Configure CI/CD coverage gate in GitHub Actions
  ```bash
  npm run test:coverage
  # Current: <10% | Target: 70%+
  ```

---

### 🟡 PRIORITY 2 — PERFORMANCE OPTIMIZATION (4-6 hours)

- [ ] **Code-Split Large Bundles**
  - [ ] Lazy load Mermaid diagrams
    ```tsx
    const MermaidDiagram = lazy(() => import('./components/MermaidDiagram'));
    ```
  - [ ] Lazy load Recharts components
    ```tsx
    const CallFrequencyChart = lazy(() => import('./components/charts/CallFrequencyChart'));
    ```
  - [ ] Add manual chunks to `vite.config.ts`:
    ```ts
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'mermaid': ['mermaid'],
            'charts': ['recharts'],
            'd3': ['d3']
          }
        }
      }
    }
    ```
  **Target:** Reduce main bundle from 685 kB to <300 kB

---

### 🟢 PRIORITY 3 — REPOSITORY HYGIENE (30 minutes)

- [x] **Normalize Line Endings**
  - [x] `.gitattributes` created and staged
  - [ ] Run `git add --renormalize .` to apply to existing files

- [ ] **Clean Up Root Directory**
  ```bash
  mkdir -p docs/engineering-reviews
  mv *REVIEW*.md *SUMMARY*.md *STATUS*.txt docs/engineering-reviews/
  git add docs/engineering-reviews/
  ```

- [ ] **Verify .gitignore Coverage**
  ```bash
  # Ensure backend venv is properly ignored
  echo "mcp-backend/venv/" >> .gitignore
  echo "mcp-backend/.venv/" >> .gitignore
  git rm -r --cached mcp-backend/venv/ 2>/dev/null || true
  ```

---

### 📋 NEXT SPRINT GOALS

- [ ] Document conflict resolution strategy for `SyncService`
- [ ] Add Sentry or similar APM for production monitoring
- [ ] Run Lighthouse accessibility audit (WCAG 2.1 AA compliance)
- [ ] Set up Playwright E2E tests for critical flows

---

### ✅ COMPLETED AUTOMATICALLY

- [x] **.gitattributes created** — Prevents CRLF/LF warnings
- [x] **Engineering review report generated** — See ENGINEERING_REVIEW_2026-06-20.md
- [x] **Executive summary created** — See EXEC_SUMMARY_2026-06-20.txt

---

## Acceptance Criteria for Production

| Requirement | Current | Target | Status |
|-------------|---------|--------|--------|
| TypeScript errors | 0 | 0 | ✅ PASS |
| ESLint warnings | 0 | 0 | ✅ PASS |
| Security vulnerabilities | 0 | 0 | ✅ PASS |
| Test coverage | <10% | 70%+ | ❌ FAIL |
| Bundle size (main) | 685 kB | <300 kB | ⚠️ WARN |
| Whisper service | ❌ Not ready | ✅ Ready | ❌ FAIL |
| Health endpoint | ✅ Operational | ✅ Operational | ✅ PASS |
| Database connectivity | ✅ Connected | ✅ Connected | ✅ PASS |

**Production Readiness: 6/8 criteria met (75%)**

---

## Commands Quick Reference

```bash
# Run full validation suite
npm run lint && npm run type-check && npm run test && npm run build

# Check backend health
curl http://localhost:8000/health

# Run test coverage report
npm run test:coverage

# Clean build artifacts
rm -rf dist/ node_modules/.vite/

# Audit dependencies
npm audit --production
```
