# enable-live-reload.ps1
# Enables Tailscale-powered hot reload for the Horizon APK.
# The APK WebView loads code from the Tailscale Funnel URL instead of
# bundled assets — any React/TS change instantly reflects on the phone,
# even when it is NOT on the local network.
#
# Usage: .\scripts\enable-live-reload.ps1
# To disable: .\scripts\enable-live-reload.ps1 -Disable

param([switch]$Disable)

$TAILSCALE_HOST = "hp-z2g3-mini-workstation.tailb79f25.ts.net"
$LIVE_URL = "https://${TAILSCALE_HOST}:10000"
$PROJECT_ROOT = Split-Path $PSScriptRoot -Parent

if ($Disable) {
    Write-Host "[Horizon] Disabling live reload — building production APK..." -ForegroundColor Yellow
    Remove-Item Env:HORIZON_LIVE_URL -ErrorAction SilentlyContinue
    Set-Location $PROJECT_ROOT
    npm run build
    npx cap sync android
    Write-Host "[Horizon] Production build synced. Rebuild/reinstall APK." -ForegroundColor Green
    exit 0
}

Write-Host "[Horizon] Enabling APK live reload via Tailscale Funnel" -ForegroundColor Cyan
Write-Host "  Live URL: $LIVE_URL" -ForegroundColor Cyan

# Step 1: Ensure Tailscale funnel is active on port 10000
Write-Host "[Horizon] Starting Tailscale funnel on port 10000..." -ForegroundColor Yellow
tailscale funnel --bg --https=10000 http://localhost:3000
if ($LASTEXITCODE -ne 0) {
    Write-Warning "Tailscale funnel command failed. Is Tailscale running and authenticated?"
    Write-Warning "Try: tailscale up"
    exit 1
}

# Step 2: Set env var and sync Capacitor
$env:HORIZON_LIVE_URL = $LIVE_URL
Set-Location $PROJECT_ROOT

Write-Host "[Horizon] Syncing Capacitor with live reload URL..." -ForegroundColor Yellow
npx cap sync android

Write-Host ""
Write-Host "================================================================" -ForegroundColor Green
Write-Host "  APK Live Reload ENABLED" -ForegroundColor Green
Write-Host "  Dev server URL: $LIVE_URL" -ForegroundColor Green
Write-Host ""
Write-Host "  Next steps:" -ForegroundColor White
Write-Host "  1. Start Vite dev server:  npm run dev" -ForegroundColor White
Write-Host "  2. Install/run the APK:    npx cap run android" -ForegroundColor White
Write-Host "     OR install existing APK and open Horizon on phone" -ForegroundColor White
Write-Host "  3. Make code changes — the APK hot-reloads instantly" -ForegroundColor White
Write-Host ""
Write-Host "  To disable (production): .\scripts\enable-live-reload.ps1 -Disable" -ForegroundColor Gray
Write-Host "================================================================" -ForegroundColor Green
