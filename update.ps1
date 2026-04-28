Write-Host "🔄 Updating Project Horizon..." -ForegroundColor Cyan

Write-Host "📥 Pulling latest changes from git..."
git pull

Write-Host "📦 Updating Node dependencies (npm install)..."
npm install

Write-Host "🐍 Updating Python dependencies (pip install)..."
if (Test-Path ".venv") {
    & .venv\Scripts\python.exe -m pip install -r mcp-backend\requirements.txt
} else {
    Write-Host "⚠️ Virtual environment not found at .venv" -ForegroundColor Red
}

Write-Host "✅ Update complete." -ForegroundColor Green
