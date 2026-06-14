"""
Horizon Pipeline Supervisor
============================
Long-running process guardian that ensures the transcription pipeline
never goes down. Designed to run as a Windows startup task or service.

Responsibilities:
  1. Start and monitor the ingestion server (port 9000)
  2. Start and monitor the main API server (port 8000)
  3. Health-check both servers on a 30-second loop
  4. Auto-restart crashed processes with exponential backoff
  5. Ensure Tailscale funnel is active (port 9000)
  6. Log everything for diagnostics

Usage:
  # Run directly (foreground):
  python horizon_supervisor.py

  # Run as a Windows startup task:
  # 1. Open Task Scheduler
  # 2. Create Basic Task → "Horizon Pipeline Supervisor"
  # 3. Trigger: "At startup"
  # 4. Action: Start a program
  #    Program: C:\\Users\\owner\\Desktop\\horizon\\.venv\\Scripts\\python.exe
  #    Arguments: horizon_supervisor.py
  #    Start in: C:\\Users\\owner\\Desktop\\horizon\\mcp-backend
  # 5. Check "Run whether user is logged on or not"

  # Or use pythonw.exe for invisible background mode:
  #    Program: C:\\Users\\owner\\Desktop\\horizon\\.venv\\Scripts\\pythonw.exe
"""

import subprocess
import time
import sys
import os
import signal
import logging
from datetime import datetime
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import URLError

# PATCH-01 (C6): Skip --reload in production to avoid inotify overhead on Z2G3.
# Set PRODUCTION=1 in Task Scheduler or start.ps1 when running live.
_PRODUCTION = os.getenv("PRODUCTION", "").strip().lower() in ("1", "true", "yes")

# ── Configuration ────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).parent.parent.resolve()
BACKEND_DIR = Path(__file__).parent.resolve()
VENV_PYTHON = PROJECT_ROOT / ".venv" / "Scripts" / "python.exe"

SERVERS = {
    "ingestion": {
        "module": "ingestion_server:app",
        "port": 9000,
        "health_url": "http://localhost:9000/v1/health",
        "critical": True,  # Must always be running
    },
    "api": {
        "module": "main:app",
        "port": 8000,
        "health_url": "http://localhost:8000/api/v1/health",
        "critical": False,  # Nice to have, frontend can degrade gracefully
    },
}

HEALTH_CHECK_INTERVAL = 30       # seconds between health checks
MAX_RESTART_BACKOFF = 300        # max 5 min between restart attempts
HEALTH_CHECK_TIMEOUT = 10        # seconds to wait for health response
TAILSCALE_FUNNEL_PORT = 9000     # port to funnel via Tailscale

# ── Logging ──────────────────────────────────────────────────────────────────
LOG_DIR = BACKEND_DIR / "logs"
LOG_DIR.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [SUPERVISOR] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(LOG_DIR / "supervisor.log", encoding="utf-8"),
    ],
)
log = logging.getLogger("supervisor")


# ── Process Management ───────────────────────────────────────────────────────

class ManagedProcess:
    """Manages a single uvicorn server process with auto-restart."""

    def __init__(self, name: str, config: dict):
        self.name = name
        self.module = config["module"]
        self.port = config["port"]
        self.health_url = config["health_url"]
        self.critical = config["critical"]
        self.process: subprocess.Popen | None = None
        self.restart_count = 0
        self.last_restart: float = 0
        self.last_healthy: float = 0
        self.consecutive_health_failures = 0

    def start(self):
        """Start the uvicorn process."""
        if self.process and self.process.poll() is None:
            log.info(f"[{self.name}] Already running (PID {self.process.pid})")
            return

        python = str(VENV_PYTHON) if VENV_PYTHON.exists() else sys.executable
        cmd = [
            python, "-m", "uvicorn",
            self.module,
            "--host", "0.0.0.0",
            "--port", str(self.port),
        ]
        if not _PRODUCTION:
            cmd.extend(["--reload", "--reload-dir", str(BACKEND_DIR)])

        log_file = LOG_DIR / f"{self.name}.log"
        log.info(f"[{self.name}] Starting: {' '.join(cmd)}")
        log.info(f"[{self.name}] Logging to: {log_file}")

        self.process = subprocess.Popen(
            cmd,
            cwd=str(BACKEND_DIR),
            stdout=open(log_file, "a", encoding="utf-8"),
            stderr=subprocess.STDOUT,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
        )
        self.last_restart = time.time()
        self.restart_count += 1
        log.info(f"[{self.name}] Started (PID {self.process.pid}, restart #{self.restart_count})")

    def is_running(self) -> bool:
        """Check if the OS process is still alive."""
        if not self.process:
            return False
        return self.process.poll() is None

    def health_check(self) -> bool:
        """HTTP health check — returns True if server responds 200."""
        try:
            req = Request(self.health_url, method="GET")
            with urlopen(req, timeout=HEALTH_CHECK_TIMEOUT) as resp:
                if resp.status == 200:
                    self.consecutive_health_failures = 0
                    self.last_healthy = time.time()
                    return True
        except (URLError, OSError, TimeoutError):
            pass

        self.consecutive_health_failures += 1
        return False

    def restart(self):
        """Kill and restart the process with backoff."""
        # Calculate backoff: 2^n seconds, capped at MAX_RESTART_BACKOFF
        backoff = min(2 ** min(self.restart_count, 8), MAX_RESTART_BACKOFF)
        time_since_last = time.time() - self.last_restart

        if time_since_last < backoff:
            wait_remaining = backoff - time_since_last
            log.info(f"[{self.name}] Backoff: waiting {wait_remaining:.0f}s before restart")
            time.sleep(wait_remaining)

        self.stop()
        time.sleep(2)  # Brief pause to release port
        self.start()

    def stop(self):
        """Gracefully stop the process."""
        if self.process and self.process.poll() is None:
            log.info(f"[{self.name}] Stopping PID {self.process.pid}...")
            try:
                self.process.terminate()
                self.process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                log.warning(f"[{self.name}] Force-killing PID {self.process.pid}")
                self.process.kill()
                self.process.wait(timeout=5)
            log.info(f"[{self.name}] Stopped.")

    def status(self) -> dict:
        return {
            "name": self.name,
            "running": self.is_running(),
            "pid": self.process.pid if self.process else None,
            "port": self.port,
            "restart_count": self.restart_count,
            "consecutive_health_failures": self.consecutive_health_failures,
            "last_healthy": datetime.fromtimestamp(self.last_healthy).isoformat() if self.last_healthy else None,
        }


# ── Tailscale Funnel ─────────────────────────────────────────────────────────

def ensure_tailscale_funnel():
    """Ensure Tailscale funnel is active for the ingestion server port."""
    try:
        result = subprocess.run(
            ["tailscale", "funnel", "status"],
            capture_output=True, text=True, timeout=10,
        )
        if str(TAILSCALE_FUNNEL_PORT) in result.stdout:
            log.info(f"[TAILSCALE] Funnel already active on port {TAILSCALE_FUNNEL_PORT}")
            return True
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass

    try:
        log.info(f"[TAILSCALE] Setting up funnel on port {TAILSCALE_FUNNEL_PORT}...")
        subprocess.Popen(
            ["tailscale", "funnel", str(TAILSCALE_FUNNEL_PORT)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
        )
        log.info("[TAILSCALE] Funnel command issued.")
        return True
    except FileNotFoundError:
        log.warning("[TAILSCALE] tailscale CLI not found. Funnel must be set up manually.")
        return False
    except Exception as e:
        log.error(f"[TAILSCALE] Funnel setup failed: {e}")
        return False


# ── Main Supervisor Loop ─────────────────────────────────────────────────────

def main():
    log.info("=" * 60)
    log.info("  HORIZON PIPELINE SUPERVISOR")
    log.info(f"  Started: {datetime.now().isoformat()}")
    log.info(f"  Backend dir: {BACKEND_DIR}")
    log.info(f"  Python: {VENV_PYTHON if VENV_PYTHON.exists() else sys.executable}")
    log.info(f"  Mode: {'PRODUCTION' if _PRODUCTION else 'DEVELOPMENT'} | reload: {'disabled' if _PRODUCTION else 'enabled'}")
    log.info("=" * 60)

    # Initialize managed processes
    processes = {
        name: ManagedProcess(name, config)
        for name, config in SERVERS.items()
    }

    # Handle shutdown gracefully
    running = True

    def shutdown(signum, frame):
        nonlocal running
        log.info(f"Received signal {signum}. Shutting down all processes...")
        running = False

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    # Initial startup
    for proc in processes.values():
        proc.start()
        time.sleep(3)  # Stagger startups to avoid port conflicts

    # Set up Tailscale funnel
    ensure_tailscale_funnel()

    # Give servers time to boot
    log.info("Waiting 10s for servers to initialize...")
    time.sleep(10)

    # Main supervision loop
    cycle = 0
    while running:
        cycle += 1
        log.info(f"--- Health check cycle #{cycle} ---")

        for name, proc in processes.items():
            # 1. Check if process is still alive
            if not proc.is_running():
                log.error(f"[{name}] Process CRASHED (was PID {proc.process.pid if proc.process else '?'})")
                proc.restart()
                continue

            # 2. HTTP health check
            healthy = proc.health_check()
            if healthy:
                log.info(f"[{name}] Healthy (PID {proc.process.pid})")
            else:
                log.warning(
                    f"[{name}] Health check FAILED "
                    f"({proc.consecutive_health_failures} consecutive)"
                )

                # Restart after 3 consecutive health failures
                if proc.consecutive_health_failures >= 3:
                    log.error(
                        f"[{name}] {proc.consecutive_health_failures} consecutive failures. "
                        f"Restarting..."
                    )
                    proc.restart()

        # Periodic Tailscale funnel check (every 10 cycles = ~5 min)
        if cycle % 10 == 0:
            ensure_tailscale_funnel()

        # Status summary (every 20 cycles = ~10 min)
        if cycle % 20 == 0:
            log.info("=== SUPERVISOR STATUS ===")
            for name, proc in processes.items():
                s = proc.status()
                log.info(
                    f"  {name}: {'UP' if s['running'] else 'DOWN'} "
                    f"PID={s['pid']} restarts={s['restart_count']} "
                    f"health_fails={s['consecutive_health_failures']}"
                )
            log.info("=========================")

        try:
            time.sleep(HEALTH_CHECK_INTERVAL)
        except KeyboardInterrupt:
            break

    # Graceful shutdown
    log.info("Shutting down all managed processes...")
    for proc in processes.values():
        proc.stop()
    log.info("Supervisor stopped.")


if __name__ == "__main__":
    main()
