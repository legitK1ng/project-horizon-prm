Write-Host "🚀 Starting Project Horizon..." -ForegroundColor Cyan

# 1. Start Backend
Write-Host "📦 Starting FastAPI Backend..." -ForegroundColor Yellow
# Using powershell to start in new window so we can see logs
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd mcp-backend; ..\.venv\Scripts\python.exe -m uvicorn main:app --port 8000 --reload"

# 2. Start Frontend
Write-Host "💻 Starting Vite Frontend..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev -- --port 5173"

# 3. Wait a moment
Start-Sleep -Seconds 5

# 4. Open Browser
Write-Host "🌐 Opening Dashboard..." -ForegroundColor White
Start-Process "http://localhost:5173"
