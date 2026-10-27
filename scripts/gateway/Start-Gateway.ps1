<#
.SYNOPSIS
    Start-Gateway.ps1 — Launches the ACR Transcription Gateway server.

.DESCRIPTION
    Activates the mcp-backend virtual environment and starts uvicorn
    bound to all interfaces (0.0.0.0:8000) for Tailscale reachability.

.EXAMPLE
    .\scripts\Start-Gateway.ps1
#>

$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "Horizon ACR Gateway — Running"

$BackendDir = Join-Path $PSScriptRoot "..\mcp-backend"
$VenvActivate = Join-Path $BackendDir "venv\Scripts\Activate.ps1"

if (-not (Test-Path $VenvActivate)) {
    Write-Error "Virtual environment not found. Run Setup-Gateway.ps1 first."
    exit 1
}

Write-Host @"
╔══════════════════════════════════════════════════════════════╗
║          PROJECT HORIZON — ACR Gateway Starting              ║
║          Accessible at: https://100.101.99.29:8000           ║
║          ACR Endpoint:  /api/Recording/upload                ║
╚══════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Blue

# Activate venv
. $VenvActivate

# Start server (api mode = uvicorn HTTP, not MCP stdio)
Set-Location $BackendDir
Write-Host "[Gateway] Starting uvicorn on 0.0.0.0:8000 ..." -ForegroundColor Cyan
python main.py api
