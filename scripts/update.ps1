$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

Write-Host "🔄 Updating Project Horizon..." -ForegroundColor Cyan

Write-Host "📥 Pulling latest changes from git..."
git pull

Write-Host "📦 Updating Node dependencies (npm install)..."
npm install

Write-Host "🐍 Updating Python dependencies (pip install)..."
$VenvPython = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
$RequirementsFile = Join-Path $ProjectRoot "mcp-backend\requirements.txt"
if (Test-Path $VenvPython) {
    & $VenvPython -m pip install -r $RequirementsFile
} else {
    Write-Host "⚠️ Virtual environment not found at $VenvPython" -ForegroundColor Red
}

Write-Host "✅ Update complete." -ForegroundColor Green
