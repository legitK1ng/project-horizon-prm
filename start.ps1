Write-Host ""
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host "    HORIZON PIPELINE — SUPERVISED STARTUP" -ForegroundColor Cyan
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host ""

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $ProjectRoot "mcp-backend"
$VenvPython = Join-Path $ProjectRoot ".venv\Scripts\python.exe"

if (-not (Test-Path $VenvPython)) {
    Write-Host "  [ERROR] Python venv not found at: $VenvPython" -ForegroundColor Red
    Write-Host "  Run: python -m venv .venv && .venv\Scripts\pip install -r mcp-backend\requirements.txt" -ForegroundColor Yellow
    exit 1
}

# 1. Start Pipeline Supervisor (manages both API + Ingestion servers with auto-restart)
Write-Host "  [1/3] Starting Pipeline Supervisor..." -ForegroundColor Yellow
Write-Host "        Manages: API (8000) + Ingestion (9000) + Tailscale Funnel" -ForegroundColor DarkGray
Write-Host "        Auto-restarts crashed processes with health checks every 30s" -ForegroundColor DarkGray
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$BackendDir'; & '$VenvPython' horizon_supervisor.py"

# 2. Start Frontend
Write-Host "  [2/3] Starting Vite Frontend..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$ProjectRoot'; npm run dev -- --port 5173"

# 3. Wait for services to initialize
Write-Host ""
Write-Host "  Waiting for services to initialize..." -ForegroundColor DarkGray
Start-Sleep -Seconds 12

# 4. Health check
Write-Host ""
Write-Host "  --- Health Check ---" -ForegroundColor Cyan

$services = @(
    @{ Name = "API Server";       URL = "http://localhost:8000/api/v1/health" },
    @{ Name = "Ingestion Server"; URL = "http://localhost:9000/v1/health" },
    @{ Name = "Frontend";         URL = "http://localhost:5173" }
)

foreach ($svc in $services) {
    try {
        $response = Invoke-WebRequest -Uri $svc.URL -TimeoutSec 5 -ErrorAction Stop
        Write-Host "  [OK] $($svc.Name) — $($svc.URL)" -ForegroundColor Green
    } catch {
        Write-Host "  [!!] $($svc.Name) — not ready yet (may still be booting)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "  Pipeline is supervised. Processes will auto-restart on crash." -ForegroundColor Cyan
Write-Host "  Logs: mcp-backend/logs/supervisor.log" -ForegroundColor DarkGray
Write-Host ""

# 5. Open Browser
Start-Process "http://localhost:5173"
