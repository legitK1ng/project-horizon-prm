Write-Host "🛑 Killing Project Horizon processes..." -ForegroundColor Red

# Kill process on port 8000 (Backend)
$backendPids = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
foreach ($pid in $backendPids) {
    if ($pid) {
        Write-Host "Killing Backend (PID: $pid)"
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    }
}

# Kill process on port 5173 (Frontend)
$frontendPids = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
foreach ($pid in $frontendPids) {
    if ($pid) {
        Write-Host "Killing Frontend (PID: $pid)"
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    }
}

# Also kill common uvicorn/node processes if they are dangling
Get-Process python -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*uvicorn*" } | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*vite*" } | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host "✅ Done." -ForegroundColor Gray
