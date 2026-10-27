# HORIZON PRM — EMERGENCY FIX SCRIPTS
**Generated:** 2026-06-19 (Automated Review)  
**Priority:** EXECUTE IMMEDIATELY  
**Estimated Time:** 2 hours total

---

## 🚨 EMERGENCY FIX #1: Kill Orphan Processes (5 minutes)

### PowerShell Script: `fix-orphan-processes.ps1`

```powershell
# ======================================================================
# HORIZON PRM - Emergency Process Cleanup
# ======================================================================
# Purpose: Kill all orphan Python processes and verify clean state
# CRITICAL: This will stop all Python processes. Only run when ready.
# ======================================================================

Write-Host "=== HORIZON PRM: Emergency Process Cleanup ===" -ForegroundColor Red
Write-Host ""

# Step 1: List current Python processes
Write-Host "Step 1: Current Python processes:" -ForegroundColor Yellow
Get-Process python -ErrorAction SilentlyContinue | 
    Select-Object Id, CPU, WorkingSet, Path | 
    Format-Table -AutoSize

$processCount = (Get-Process python -ErrorAction SilentlyContinue | Measure-Object).Count
Write-Host "Total Python processes: $processCount" -ForegroundColor Yellow
Write-Host ""

# Step 2: Confirm before proceeding
$confirmation = Read-Host "Do you want to kill all Python processes? (yes/no)"
if ($confirmation -ne 'yes') {
    Write-Host "Aborted by user." -ForegroundColor Red
    exit 1
}

# Step 3: Kill all Python processes
Write-Host "Step 2: Killing all Python processes..." -ForegroundColor Yellow
Get-Process python -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

# Step 4: Verify clean state
Write-Host "Step 3: Verifying clean state..." -ForegroundColor Yellow
$remainingProcesses = (Get-Process python -ErrorAction SilentlyContinue | Measure-Object).Count

if ($remainingProcesses -eq 0) {
    Write-Host "SUCCESS: All Python processes terminated." -ForegroundColor Green
} else {
    Write-Host "WARNING: $remainingProcesses Python processes still running:" -ForegroundColor Yellow
    Get-Process python -ErrorAction SilentlyContinue | 
        Select-Object Id, CPU, WorkingSet, Path | 
        Format-Table -AutoSize
}

# Step 5: Delete stale PID files
Write-Host "Step 4: Removing stale PID files..." -ForegroundColor Yellow
$pidFiles = Get-ChildItem -Path "C:\Users\owner\Desktop\horizon\mcp-backend" -Filter "*.pid" -ErrorAction SilentlyContinue
if ($pidFiles) {
    $pidFiles | Remove-Item -Force
    Write-Host "Removed PID files: $($pidFiles.Name -join ', ')" -ForegroundColor Green
} else {
    Write-Host "No stale PID files found." -ForegroundColor Green
}

Write-Host ""
Write-Host "=== Cleanup Complete ===" -ForegroundColor Green
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Apply PID locking patch to horizon_supervisor.py" -ForegroundColor Cyan
Write-Host "2. Restart supervisor: python horizon_supervisor.py" -ForegroundColor Cyan
Write-Host "3. Verify process count: Get-Process python | Measure-Object" -ForegroundColor Cyan
```

**Execute:**
```powershell
# Save script to file
New-Item -Path "C:\Users\owner\Desktop\horizon\fix-orphan-processes.ps1" -ItemType File -Force

# Run script
cd C:\Users\owner\Desktop\horizon
.\fix-orphan-processes.ps1
```

---

## 🚨 EMERGENCY FIX #2: Add PID Locking to Supervisor (30 minutes)

### Python Module: `mcp-backend/core/process_lock.py`

```python
"""
Process locking utility to prevent duplicate supervisor instances.
Horizon PRM - Emergency Fix #2
"""
import os
import sys
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

class ProcessLock:
    """
    Simple file-based process lock to prevent duplicate supervisor instances.
    Uses PID file with staleness detection.
    """
    
    def __init__(self, lock_file: Path):
        self.lock_file = lock_file
        self.pid = os.getpid()
    
    def acquire(self) -> bool:
        """
        Acquire process lock.
        Returns True if successful, False if another instance is running.
        """
        if self.lock_file.exists():
            try:
                existing_pid = int(self.lock_file.read_text().strip())
                
                # Check if process is still running (Windows-compatible)
                if self._is_process_running(existing_pid):
                    logger.error(
                        f"[LOCK] Another supervisor instance is already running (PID {existing_pid}). "
                        f"Exiting to prevent duplicate instances."
                    )
                    return False
                
                # Stale PID file — remove it
                logger.warning(f"[LOCK] Stale PID file found (PID {existing_pid} not running). Removing.")
                self.lock_file.unlink()
                
            except (ValueError, FileNotFoundError) as e:
                logger.warning(f"[LOCK] Corrupted PID file found ({e}). Removing.")
                self.lock_file.unlink(missing_ok=True)
        
        # Write our PID
        self.lock_file.write_text(str(self.pid))
        logger.info(f"[LOCK] Process lock acquired (PID {self.pid}, file: {self.lock_file})")
        return True
    
    def release(self):
        """Release lock on clean shutdown."""
        if self.lock_file.exists():
            try:
                existing_pid = int(self.lock_file.read_text().strip())
                if existing_pid == self.pid:
                    self.lock_file.unlink()
                    logger.info(f"[LOCK] Process lock released (PID {self.pid})")
                else:
                    logger.warning(
                        f"[LOCK] PID mismatch during release "
                        f"(expected {self.pid}, found {existing_pid}). Not removing lock file."
                    )
            except (ValueError, FileNotFoundError):
                pass
    
    def _is_process_running(self, pid: int) -> bool:
        """
        Check if a process with given PID is running.
        Windows-compatible implementation.
        """
        try:
            # Try psutil first (more reliable)
            import psutil
            return psutil.pid_exists(pid)
        except ImportError:
            # Fallback: Windows tasklist command
            if os.name == 'nt':
                import subprocess
                try:
                    output = subprocess.check_output(
                        ['tasklist', '/FI', f'PID eq {pid}'],
                        stderr=subprocess.DEVNULL,
                        text=True
                    )
                    return str(pid) in output
                except subprocess.CalledProcessError:
                    return False
            else:
                # Unix: send signal 0 (doesn't kill, just checks existence)
                try:
                    os.kill(pid, 0)
                    return True
                except OSError:
                    return False
```

### Patch for `horizon_supervisor.py`

**Add after imports (around line 42):**
```python
# ── EMERGENCY FIX: Process Locking ────────────────────────────────────────────
try:
    from core.process_lock import ProcessLock
    LOCK_FILE = BACKEND_DIR / "supervisor.pid"
    USE_LOCKING = True
except ImportError:
    ProcessLock = None
    LOCK_FILE = None
    USE_LOCKING = False
    logging.warning("[SUPERVISOR] ProcessLock not available — duplicate instances not prevented!")
```

**Add to main() function (before Supervisor() initialization):**
```python
def main():
    """Main entry point."""
    log.info(f"[SUPERVISOR] Horizon Pipeline Supervisor starting...")
    log.info(f"[SUPERVISOR] Production mode: {_PRODUCTION}")
    
    # ── EMERGENCY FIX: Acquire process lock ──────────────────────────────────
    if USE_LOCKING:
        lock = ProcessLock(LOCK_FILE)
        if not lock.acquire():
            log.error("[SUPERVISOR] Failed to acquire process lock. Another instance is running.")
            sys.exit(1)
        
        # Register cleanup handlers
        def cleanup_handler(signum, frame):
            log.info(f"[SUPERVISOR] Received signal {signum}, cleaning up...")
            lock.release()
            sys.exit(0)
        
        signal.signal(signal.SIGTERM, cleanup_handler)
        signal.signal(signal.SIGINT, cleanup_handler)
    else:
        lock = None
        log.warning("[SUPERVISOR] Running WITHOUT process locking — duplicate instances possible!")
    # ────────────────────────────────────────────────────────────────────────
    
    try:
        supervisor = Supervisor()
        supervisor.run()
    except KeyboardInterrupt:
        log.info("[SUPERVISOR] Interrupted by user")
    except Exception as e:
        log.error(f"[SUPERVISOR] Fatal error: {e}", exc_info=True)
    finally:
        if lock:
            lock.release()
        log.info("[SUPERVISOR] Supervisor stopped")
```

**Save and Test:**
```powershell
cd C:\Users\owner\Desktop\horizon\mcp-backend

# Create core/process_lock.py (copy code above)

# Test supervisor startup
..\.venv\Scripts\python.exe horizon_supervisor.py

# In another terminal, try to start duplicate (should fail)
..\.venv\Scripts\python.exe horizon_supervisor.py
# Expected output: "[LOCK] Another supervisor instance is already running (PID XXXXX). Exiting..."
```

---

## 🚨 CRITICAL FIX #3: Fix Security Vulnerabilities (15 minutes)

### NPM Audit Fix Script

```powershell
# ======================================================================
# HORIZON PRM - Security Vulnerability Fix
# ======================================================================

Write-Host "=== HORIZON PRM: Security Vulnerability Fix ===" -ForegroundColor Red
Write-Host ""

# Step 1: Show current vulnerabilities
Write-Host "Step 1: Current vulnerabilities:" -ForegroundColor Yellow
npm audit --production

Write-Host ""
Write-Host "Step 2: Running npm audit fix..." -ForegroundColor Yellow
npm audit fix

Write-Host ""
Write-Host "Step 3: Running npm audit fix --force (for remaining issues)..." -ForegroundColor Yellow
npm audit fix --force

Write-Host ""
Write-Host "Step 4: Verifying fix..." -ForegroundColor Yellow
$auditResult = npm audit --production 2>&1
if ($auditResult -match "found 0 vulnerabilities") {
    Write-Host "SUCCESS: All vulnerabilities resolved!" -ForegroundColor Green
} else {
    Write-Host "Remaining vulnerabilities:" -ForegroundColor Yellow
    npm audit --production
}

Write-Host ""
Write-Host "=== Security Fix Complete ===" -ForegroundColor Green
```

**Execute:**
```powershell
cd C:\Users\owner\Desktop\horizon
npm audit fix
npm audit fix --force
npm audit --production
```

---

## 🚨 CRITICAL FIX #4: Pin Backend Dependencies (30 minutes)

### Dependency Pinning Script

```powershell
# ======================================================================
# HORIZON PRM - Pin Backend Dependencies
# ======================================================================

Write-Host "=== HORIZON PRM: Pin Backend Dependencies ===" -ForegroundColor Red
Write-Host ""

cd C:\Users\owner\Desktop\horizon\mcp-backend

# Step 1: Activate virtual environment
Write-Host "Step 1: Activating virtual environment..." -ForegroundColor Yellow
& "..\.venv\Scripts\Activate.ps1"

# Step 2: Backup current requirements
Write-Host "Step 2: Backing up requirements.txt..." -ForegroundColor Yellow
Copy-Item requirements.txt requirements_BACKUP_$(Get-Date -Format 'yyyyMMdd_HHmmss').txt

# Step 3: Generate pinned requirements
Write-Host "Step 3: Generating pinned requirements..." -ForegroundColor Yellow
pip freeze | Out-File -FilePath requirements_pinned.txt -Encoding utf8

# Step 4: Review
Write-Host "Step 4: Review pinned dependencies:" -ForegroundColor Yellow
Get-Content requirements_pinned.txt | Select-Object -First 20
Write-Host "... (showing first 20 lines)" -ForegroundColor Gray

# Step 5: Replace
Write-Host ""
$confirmation = Read-Host "Replace requirements.txt with pinned versions? (yes/no)"
if ($confirmation -eq 'yes') {
    Move-Item requirements_pinned.txt requirements.txt -Force
    Write-Host "SUCCESS: requirements.txt updated with pinned versions" -ForegroundColor Green
} else {
    Write-Host "Aborted. Pinned versions saved to requirements_pinned.txt" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Dependency Pinning Complete ===" -ForegroundColor Green
```

**Execute:**
```powershell
cd C:\Users\owner\Desktop\horizon\mcp-backend
..\.venv\Scripts\Activate.ps1
pip freeze > requirements_pinned.txt
# Review and replace requirements.txt manually
```

---

## 🚨 CRITICAL FIX #5: Fix Bundle Size (2 hours)

### Step 1: Update vite.config.ts

```typescript
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const liveUrl = env.HORIZON_LIVE_URL || env.HORIZON_DEV_URL || '';
  let hmrConfig: Record<string, unknown> | undefined;
  if (liveUrl) {
    try {
      const u = new URL(liveUrl);
      hmrConfig = {
        protocol: u.protocol === 'https:' ? 'wss' : 'ws',
        host: u.hostname,
        port: u.port ? parseInt(u.port) : (u.protocol === 'https:' ? 443 : 80),
        clientPort: u.port ? parseInt(u.port) : (u.protocol === 'https:' ? 443 : 80),
      };
    } catch { /* ignore invalid URL */ }
  }

  return {
    plugins: [react()],

    server: {
      port: 3000,
      host: true,
      open: !liveUrl,
      strictPort: false,
      ...(hmrConfig ? { hmr: hmrConfig } : {}),
      proxy: {
        '/api': {
          target: env.VITE_BACKEND_URL || 'http://localhost:8000',
          changeOrigin: true,
          secure: false,
        },
      },
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@/components': path.resolve(__dirname, './src/components'),
        '@/services': path.resolve(__dirname, './src/services'),
        '@/contexts': path.resolve(__dirname, './src/contexts'),
        '@/hooks': path.resolve(__dirname, './src/hooks'),
        '@/types': path.resolve(__dirname, './src/types'),
        '@/constants': path.resolve(__dirname, './src/constants'),
        '@/utils': path.resolve(__dirname, './src/utils'),
      },
    },

    define: {
      'import.meta.env.VITE_BACKEND_URL': JSON.stringify(env.VITE_BACKEND_URL),
    },

    build: {
      outDir: 'dist',
      sourcemap: mode !== 'production',
      chunkSizeWarningLimit: 500, // ✅ EMERGENCY FIX: Enforce 500 KB limit
      rollupOptions: {
        output: {
          // ✅ EMERGENCY FIX: Improved manual chunking
          manualChunks: (id) => {
            // Mermaid and diagram libraries (lazy loaded separately)
            if (id.includes('mermaid') || id.includes('elk')) {
              return 'mermaid';
            }
            
            // Chart libraries
            if (id.includes('recharts') || id.includes('d3')) {
              return 'charts';
            }
            
            // React core
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
              return 'vendor';
            }
            
            // React Router
            if (id.includes('react-router')) {
              return 'vendor';
            }
            
            // Icons
            if (id.includes('lucide-react')) {
              return 'icons';
            }
            
            // Framer Motion
            if (id.includes('framer-motion')) {
              return 'animations';
            }
            
            // TanStack Query
            if (id.includes('@tanstack')) {
              return 'vendor';
            }
            
            // Dexie
            if (id.includes('dexie')) {
              return 'vendor';
            }
          },
        },
      },
    },
    
    // ✅ EMERGENCY FIX: Remove console.log in production builds
    esbuild: {
      drop: mode === 'production' ? ['console', 'debugger'] : [],
    },
  };
});
```

### Step 2: Lazy Load Mermaid Components

**Identify components using Mermaid:**
```powershell
# Find all files importing mermaid
Get-ChildItem -Path "C:\Users\owner\Desktop\horizon\src" -Recurse -Include *.tsx,*.ts | 
    Select-String -Pattern "mermaid" |
    Select-Object -ExpandProperty Path -Unique
```

**Wrap in lazy imports:**
```typescript
// Example: src/components/Console.tsx
import { lazy, Suspense } from 'react';

// Lazy load Mermaid diagram components
const MermaidDiagram = lazy(() => import('./common/MermaidDiagram'));

// In render:
{showDiagram && (
  <Suspense fallback={<div className="animate-pulse h-64 bg-slate-800/50 rounded-lg" />}>
    <MermaidDiagram chart={diagramCode} />
  </Suspense>
)}
```

### Step 3: Test Build

```powershell
cd C:\Users\owner\Desktop\horizon

# Build and check bundle sizes
npm run build

# Expected output (after optimization):
# ✅ All chunks < 500 KB
# ✅ Largest chunk reduced from 1.45 MB to ~400 KB
```

---

## 🚨 CRITICAL FIX #6: Fix Failing Tests (1 hour)

### Updated Test File: `src/services/api.test.ts`

```typescript
/// <reference types="vitest/globals" />

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from './apiClient';

// Create robust mock fetch implementation
const createMockFetch = () => {
  return vi.fn((url: string | URL, options?: RequestInit): Promise<Response> => {
    const urlString = typeof url === 'string' ? url : url.toString();
    
    // Mock /api/v1/system/stats
    if (urlString.includes('/api/v1/system/stats')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({
          totalContacts: 150,
          totalCalls: 42,
          totalTranscriptions: 38,
          lastSync: new Date().toISOString(),
        }),
      } as Response);
    }
    
    // Mock /api/v1/ollama/models
    if (urlString.includes('/api/v1/ollama/models')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({
          models: [
            { name: 'kimi-k2:1t-cloud', size: '1.8GB', modified: '2026-06-01' }
          ],
        }),
      } as Response);
    }
    
    // Mock /api/v1/health
    if (urlString.includes('/api/v1/health')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          services: {
            supabase: 'connected',
            ollama: 'optional',
          },
        }),
      } as Response);
    }
    
    // Default: 404
    return Promise.resolve({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: new Headers(),
      json: async () => ({ error: 'Not Found' }),
    } as Response);
  });
};

describe('API Client', () => {
  beforeEach(() => {
    // Reset mock before each test
    global.fetch = createMockFetch() as any;
  });

  it('fetches health stats correctly', async () => {
    const data = await api.getStats();
    
    expect(data).toBeDefined();
    expect(data.totalContacts).toBe(150);
    expect(data.totalCalls).toBe(42);
    expect(data.totalTranscriptions).toBe(38);
    expect(data.lastSync).toBeDefined();
  });

  it('fetches models', async () => {
    const response = await api.getModels();
    
    expect(response).toBeDefined();
    expect(response.models).toBeDefined();
    expect(response.models).toHaveLength(1);
    expect(response.models[0].name).toBe('kimi-k2:1t-cloud');
  });

  it('runs diagnostics', async () => {
    const results = await api.checkHealth();
    
    expect(results).toBeDefined();
    expect(results.status).toBe('healthy');
    expect(results.timestamp).toBeDefined();
    expect(results.services).toBeDefined();
  });
});
```

**Test:**
```powershell
cd C:\Users\owner\Desktop\horizon
npm run test

# Expected output:
# ✅ All tests passing
```

---

## EXECUTION CHECKLIST

### Critical Fixes (Execute in Order)

- [ ] **FIX #1:** Kill orphan processes (5 min)
  ```powershell
  Get-Process python | Stop-Process -Force
  ```

- [ ] **FIX #2:** Add PID locking to supervisor (30 min)
  - Create `mcp-backend/core/process_lock.py`
  - Patch `horizon_supervisor.py`
  - Test with duplicate startup

- [ ] **FIX #3:** Fix security vulnerabilities (15 min)
  ```powershell
  npm audit fix
  npm audit fix --force
  ```

- [ ] **FIX #4:** Pin backend dependencies (30 min)
  ```powershell
  pip freeze > requirements.txt
  ```

- [ ] **FIX #5:** Fix bundle size (2 hours)
  - Update `vite.config.ts`
  - Lazy load Mermaid components
  - Test build

- [ ] **FIX #6:** Fix failing tests (1 hour)
  - Update `src/services/api.test.ts`
  - Run tests

### Verification

- [ ] Python process count ≤ 4
- [ ] Port 9000 has single listener
- [ ] NPM audit shows 0 HIGH/MODERATE vulnerabilities
- [ ] Build largest chunk < 500 KB
- [ ] All tests passing
- [ ] Backend dependencies pinned

---

**Total Estimated Time:** 4-5 hours  
**Next Steps:** Integration testing, staging deployment, monitoring setup

**END OF EMERGENCY FIX SCRIPTS**
