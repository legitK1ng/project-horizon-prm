# HORIZON PRM — QUICK FIX ACTIONS
**Generated:** 2026-06-19 08:30 UTC  
**Priority:** CRITICAL  
**Estimated Total Effort:** 4 days minimum viable production

---

## 🔴 EMERGENCY: Runtime Instability (DO THIS FIRST)

### Problem
**27 Python processes running** (expected: 3-4)  
**Root Cause:** `horizon_supervisor.py` has no PID file locking, spawning duplicate instances

### Immediate Fix (20 minutes)

#### Step 1: Kill All Orphan Processes
```powershell
# Stop all Python processes
Get-Process python | Stop-Process -Force

# Verify clean slate
Get-Process python
# Should show 0 processes
```

#### Step 2: Apply PID Locking Patch
Add to `mcp-backend/horizon_supervisor.py` (after imports, before SERVERS dict):

```python
import psutil
from pathlib import Path

PID_FILE = Path(__file__).parent / "supervisor.pid"

def acquire_lock():
    """Ensure only one supervisor instance runs."""
    if PID_FILE.exists():
        try:
            pid = int(PID_FILE.read_text().strip())
            if psutil.Process(pid).is_running():
                logger.error(f"[SUPERVISOR] Already running (PID {pid}). Exiting.")
                sys.exit(1)
        except (ValueError, psutil.NoSuchProcess):
            logger.warning(f"[SUPERVISOR] Stale PID file detected, removing.")
    
    PID_FILE.write_text(str(os.getpid()))
    logger.info(f"[SUPERVISOR] Lock acquired, PID: {os.getpid()}")

def release_lock():
    """Clean up PID file on shutdown."""
    try:
        if PID_FILE.exists():
            PID_FILE.unlink()
            logger.info("[SUPERVISOR] Lock released")
    except Exception as e:
        logger.error(f"[SUPERVISOR] Failed to release lock: {e}")

def cleanup_orphans():
    """Kill orphaned uvicorn processes."""
    killed = 0
    for proc in psutil.process_iter(['pid', 'name', 'cmdline', 'ppid']):
        try:
            cmdline = ' '.join(proc.info['cmdline'] or [])
            if 'uvicorn' in cmdline and ('main:app' in cmdline or 'ingestion_server:app' in cmdline):
                # Check if parent is this supervisor
                if proc.info['ppid'] != os.getpid():
                    logger.warning(f"[SUPERVISOR] Killing orphan uvicorn process {proc.info['pid']}")
                    proc.terminate()
                    killed += 1
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    
    if killed > 0:
        logger.info(f"[SUPERVISOR] Cleaned up {killed} orphan processes")
    
    time.sleep(2)  # Let processes die gracefully
```

#### Step 3: Update main() Function
Find the `main()` function and add at the very beginning:

```python
def main():
    """Main supervisor loop."""
    logger.info("[SUPERVISOR] Horizon Pipeline Supervisor starting...")
    
    # NEW: Acquire lock and cleanup orphans
    acquire_lock()
    cleanup_orphans()
    
    # NEW: Register signal handlers for clean shutdown
    def signal_handler(signum, frame):
        logger.info(f"[SUPERVISOR] Received signal {signum}, shutting down...")
        release_lock()
        sys.exit(0)
    
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)
    
    # Existing code continues here...
    procs = {}
    backoff = {}
```

#### Step 4: Install Required Dependency
```bash
cd mcp-backend
pip install psutil
pip freeze > requirements.lock.txt
```

#### Step 5: Restart Supervisor (Single Instance Only)
```powershell
cd C:\Users\owner\Desktop\horizon\mcp-backend
python horizon_supervisor.py
```

#### Step 6: Verify Success
```powershell
# Should show exactly 3 processes:
# 1x supervisor, 1x ingestion server, 1x API server
Get-Process python | Measure-Object | Select-Object -ExpandProperty Count
# Expected: 3

# Check port bindings (should show 1 process per port)
Get-NetTCPConnection -LocalPort 8000,9000 | Select-Object LocalPort, OwningProcess
```

---

## 🔴 CRITICAL: Security Vulnerabilities (30 minutes)

### Step 1: Update NPM Dependencies
```bash
# Frontend directory
cd C:\Users\owner\Desktop\horizon

# Fix auto-patchable vulnerabilities
npm audit fix

# Manual updates for breaking changes
npm install @google/clasp@2.5.0
npm install @hono/node-server@latest
npm install @xmldom/xmldom@latest

# Verify no remaining HIGH vulnerabilities
npm audit --production
```

### Step 2: Pin Python Dependencies
```bash
cd mcp-backend

# Generate lockfile with current working versions
pip freeze > requirements.lock.txt

# Review the lockfile for any obvious issues
cat requirements.lock.txt

# Replace requirements.txt with pinned versions
cp requirements.txt requirements.txt.backup
mv requirements.lock.txt requirements.txt
```

---

## 🔴 CRITICAL: Bundle Size Optimization (4 hours)

### Step 1: Add Lazy Loading for Mermaid
Create `src/components/common/LazyMermaid.tsx`:

```typescript
import React, { Suspense, lazy } from 'react';
import Skeleton from './Skeleton';

const MermaidDiagram = lazy(() => import('./MermaidDiagram'));

interface LazyMermaidProps {
  code: string;
  height?: number;
}

export const LazyMermaid: React.FC<LazyMermaidProps> = ({ code, height = 400 }) => {
  return (
    <Suspense fallback={<Skeleton height={height} />}>
      <MermaidDiagram code={code} />
    </Suspense>
  );
};
```

### Step 2: Update vite.config.ts
Replace the `build` section:

```typescript
build: {
  outDir: 'dist',
  sourcemap: mode !== 'production',
  rollupOptions: {
    output: {
      manualChunks: (id) => {
        if (id.includes('node_modules')) {
          // Mermaid diagrams (lazy load via component)
          if (id.includes('mermaid') || id.includes('elkjs') || id.includes('cytoscape')) {
            return 'diagrams';
          }
          // Math rendering (lazy load)
          if (id.includes('katex')) {
            return 'math';
          }
          // Charts
          if (id.includes('recharts') || id.includes('d3')) {
            return 'charts';
          }
          // React core
          if (id.includes('react') || id.includes('react-dom')) {
            return 'react-vendor';
          }
          // Framer Motion
          if (id.includes('framer-motion')) {
            return 'animation';
          }
          // Dexie (local DB)
          if (id.includes('dexie')) {
            return 'dexie';
          }
        }
      },
    },
  },
  chunkSizeWarningLimit: 500,
}
```

### Step 3: Replace Mermaid Usages
Find all usages of Mermaid components and wrap with Suspense:

```typescript
// Before:
<MermaidDiagram code={diagram} />

// After:
import { LazyMermaid } from '@/components/common/LazyMermaid';
<LazyMermaid code={diagram} height={400} />
```

### Step 4: Test Build
```bash
npm run build

# Verify bundle sizes
ls -lh dist/assets/*.js | sort -k5 -h
# Largest chunk should be <500 KB
```

---

## ⚠️ HIGH PRIORITY: Test Infrastructure (8 hours)

### Step 1: Create Test Setup
```bash
# Already added to package.json via autonomous fix
npm install -D @vitest/ui @vitest/coverage-v8
```

### Step 2: Create Test Config
Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/setupTests.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### Step 3: Create Test Utilities
Create `src/setupTests.ts`:

```typescript
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// Cleanup after each test
afterEach(() => {
  cleanup();
});
```

### Step 4: Create Sample Tests
Create `src/hooks/useHorizonData.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useContacts } from './useHorizonData';

// Mock API client
vi.mock('@/services/apiClient', () => ({
  api: {
    getContacts: vi.fn(() => Promise.resolve([
      { id: '1', name: 'Test Contact', email: 'test@example.com' }
    ])),
  },
}));

describe('useContacts', () => {
  it('should fetch contacts successfully', async () => {
    const { result } = renderHook(() => useContacts());
    
    await waitFor(() => {
      expect(result.current.data).toBeDefined();
      expect(result.current.data).toHaveLength(1);
    });
  });
});
```

### Step 5: Run Tests
```bash
npm run test
npm run test:coverage
```

---

## 📊 VERIFICATION CHECKLIST

After completing all fixes, verify:

```bash
# 1. Process count
Get-Process python | Measure-Object | Select-Object -ExpandProperty Count
# ✅ Should be 3

# 2. Port status
Get-NetTCPConnection -LocalPort 8000,9000
# ✅ One process per port

# 3. Security
npm audit --production
# ✅ 0 HIGH vulnerabilities

# 4. Bundle size
npm run build
# ✅ Largest chunk <500 KB

# 5. Tests
npm run test
# ✅ All passing

# 6. Type safety
npm run type-check
# ✅ 0 errors

# 7. Linting
npm run lint
# ✅ 0 warnings
```

---

## 📈 EXPECTED IMPROVEMENTS

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Python Processes | 27 | 3 | -89% |
| HIGH Vulnerabilities | 6 | 0 | -100% |
| Largest Bundle Chunk | 1,451 KB | <500 KB | -65% |
| Test Coverage | 0% | 60%+ | +60% |
| Production Readiness | 52/100 | 85/100 | +33 pts |

---

## 🚀 DEPLOYMENT READINESS

After completing these fixes:

1. ✅ Runtime stable (3-4 processes)
2. ✅ Security patched (0 HIGH vulnerabilities)
3. ✅ Performance optimized (<500 KB chunks)
4. ✅ Test coverage (60%+ on critical paths)

**Status:** READY FOR STAGING DEPLOYMENT

---

**Next Steps After Fixes:**
1. Set up CI/CD pipeline (GitHub Actions)
2. Configure error monitoring (Sentry)
3. Set up performance monitoring (Web Vitals)
4. Document deployment runbook
5. Create staging environment

**Questions? Issues?**
Refer to detailed analysis in: `ENGINEERING_AUDIT_2026-06-19_AUTO.md`
