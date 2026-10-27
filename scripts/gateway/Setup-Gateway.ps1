<#
.SYNOPSIS
    Setup-Gateway.ps1 — Windows-native install script for the ACR Transcription Gateway.

.DESCRIPTION
    Installs FFmpeg via Winget, then installs all Python dependencies into
    the mcp-backend virtual environment. Run once from the mcp-backend directory.

.PREREQUISITES
    - Python 3.10+ in PATH
    - Winget available (Windows 10 1809+ / Windows 11)
    - Run as Administrator for winget installs

.EXAMPLE
    cd C:\Users\owner\WORKPLACE\Horizon\mcp-backend
    .\..\..\scripts\Setup-Gateway.ps1
#>

$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "Horizon Gateway Setup"

function Write-Step { param([string]$msg) Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok   { param([string]$msg) Write-Host "    [OK] $msg" -ForegroundColor Green }
function Write-Warn { param([string]$msg) Write-Host "    [WARN] $msg" -ForegroundColor Yellow }

Write-Host @"
╔══════════════════════════════════════════════════════════════╗
║          PROJECT HORIZON — ACR Gateway Setup                 ║
║          Target: HP Z2G3 Mini + Surface Pro 3                ║
╚══════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Blue

# ── 1. FFmpeg via Winget ────────────────────────────────────────────────────────
Write-Step "Installing FFmpeg (required for audio processing)..."
try {
    $ffmpegCheck = & ffmpeg -version 2>&1
    Write-Ok "FFmpeg already installed — skipping."
} catch {
    Write-Warn "FFmpeg not found — installing via Winget..."
    winget install --id Gyan.FFmpeg -e --accept-source-agreements --accept-package-agreements
    Write-Ok "FFmpeg installed."
}

# ── 2. Python venv ────────────────────────────────────────────────────────────
Write-Step "Checking Python environment..."
$venvPath = ".\venv"
if (-not (Test-Path $venvPath)) {
    python -m venv $venvPath
    Write-Ok "Virtual environment created at $venvPath"
} else {
    Write-Ok "Virtual environment already exists."
}

# ── 3. Activate venv and install packages ─────────────────────────────────────
Write-Step "Installing Python dependencies..."
$pip = "$venvPath\Scripts\pip.exe"
& $pip install --upgrade pip --quiet
& $pip install -r requirements.txt

Write-Ok "All Python dependencies installed."

# ── 4. Create recording directories ──────────────────────────────────────────
Write-Step "Creating storage directories..."
New-Item -ItemType Directory -Force -Path "recordings"  | Out-Null
New-Item -ItemType Directory -Force -Path "transcripts" | Out-Null
Write-Ok "recordings/ and transcripts/ directories ready."

# ── 5. Env file check ─────────────────────────────────────────────────────────
Write-Step "Checking .env configuration..."
if (Test-Path ".env") {
    $envContent = Get-Content ".env" -Raw
    if ($envContent -match "your_huggingface_token_here") {
        Write-Warn ".env contains placeholder HF_TOKEN."
        Write-Host "    >> Edit mcp-backend\.env and replace 'your_huggingface_token_here'" -ForegroundColor Yellow
        Write-Host "    >> Accept model terms: https://huggingface.co/pyannote/speaker-diarization-3.1" -ForegroundColor Yellow
    } else {
        Write-Ok ".env looks configured."
    }
} else {
    Write-Warn ".env not found — please copy from .env.example"
}

# ── Done ──────────────────────────────────────────────────────────────────────
Write-Host @"

╔══════════════════════════════════════════════════════════════╗
║  Setup complete!                                             ║
║  Next: run .\scripts\Start-Gateway.ps1 to launch the server  ║
║                                                              ║
║  ACR Phone Webhook URL:                                      ║
║    https://100.101.99.29:8000/api/Recording/upload           ║
║  Secret: magicalbluetuba                                     ║
╚══════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Green
