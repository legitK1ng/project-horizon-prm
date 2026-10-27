# Horizon Pipeline Watcher
# Periodically audits the system health and reports status.

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

$INTERVAL = 30 # Seconds

Write-Host "`n[HORIZON] Starting Pipeline Watcher..." -ForegroundColor Cyan

while ($true) {
    Write-Host "`n--- HORIZON SYSTEM HEALTH AUDIT ---" -ForegroundColor Yellow
    Write-Host "Time: $(Get-Date -Format 'HH:mm:ss')"
    
    # 1. Check Ingestion Server (Port 9000)
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:9000/v1/health" -Method Get -ErrorAction Stop
        Write-Host "[SERVER] Ingestion Server: ONLINE (Key: $($response.api_key_prefix))" -ForegroundColor Green
    } catch {
        Write-Host "[SERVER] Ingestion Server: OFFLINE" -ForegroundColor Red
    }

    # 2. Run the System Auditor Bot
    Write-Host "`n[AUDITOR] Running Deep Integrity Check..." -ForegroundColor Gray
    $env:PYTHONPATH = Join-Path $ProjectRoot "mcp-backend"
    $VenvPython = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
    if (-not (Test-Path $VenvPython)) {
        $VenvPython = Join-Path $ProjectRoot "mcp-backend\venv\Scripts\python.exe"
    }
    $AuditorScript = Join-Path $ProjectRoot "mcp-backend\core\auditor.py"
    & $VenvPython $AuditorScript

    Write-Host "`nWaiting $INTERVAL seconds for next check..." -ForegroundColor DarkGray
    Start-Sleep -Seconds $INTERVAL
}
