# Horizon Pipeline Watcher
# Periodically audits the system health and reports status.

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
    $env:PYTHONPATH = "mcp-backend"
    & ".\mcp-backend\venv\Scripts\python.exe" "mcp-backend/core/auditor.py"

    Write-Host "`nWaiting $INTERVAL seconds for next check..." -ForegroundColor DarkGray
    Start-Sleep -Seconds $INTERVAL
}
