Write-Host "Killing Project Horizon processes..." -ForegroundColor Red

$ports = @(8000, 9000, 3000)

foreach ($port in $ports) {
    $pids = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
            Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($procId in $pids) {
        if ($procId -and $procId -gt 4) {
            $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
            if ($proc) {
                Write-Host "  Killing port $port -> PID $procId ($($proc.Name))" -ForegroundColor Yellow
                Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
            }
        }
    }
}

# Kill any remaining stale Python processes from previous supervisor runs
# (anything with a high CPU count and old start time is a zombie worker)
$stalePython = Get-Process python -ErrorAction SilentlyContinue |
               Where-Object { $_.StartTime -lt (Get-Date).AddHours(-1) }
foreach ($proc in $stalePython) {
    Write-Host "  Killing stale python PID $($proc.Id) (started $($proc.StartTime))" -ForegroundColor DarkYellow
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
}

# Kill uvicorn process if still alive
Get-Process uvicorn -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "  Killing uvicorn PID $($_.Id)" -ForegroundColor Yellow
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}

# Kill node/vite frontend
Get-Process node -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "  Killing node PID $($_.Id)" -ForegroundColor Yellow
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}

Start-Sleep -Seconds 2
Write-Host "Done. Run .\start.ps1 to restart cleanly." -ForegroundColor Green
