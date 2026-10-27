<#
.SYNOPSIS
    Test-Gateway.ps1 — Mimics an ACR Phone multipart POST to verify the handshake.

.DESCRIPTION
    Sends a real multipart/form-data request to the gateway using the exact
    field names from UploadRecordViewModel.cs. Creates a temporary test audio
    file if no real mp3 is provided.

    On success you should receive: {"status":"success","call_id":"..."}

.PARAMETER GatewayUrl
    The gateway base URL. Defaults to the Tailscale IP.

.PARAMETER AudioPath
    Path to a real .mp3 or .m4a file. If omitted, a tiny silent WAV is generated.

.EXAMPLE
    # Quick test (auto-generates a dummy audio file)
    .\scripts\Test-Gateway.ps1

    # Test with a real recording
    .\scripts\Test-Gateway.ps1 -AudioPath "C:\recordings\test_call.mp3"
#>

param(
    [string]$GatewayUrl = "https://100.101.99.29:8000",
    [string]$AudioPath  = ""
)

$ErrorActionPreference = "Continue"
$Endpoint = "$GatewayUrl/api/Recording/upload"

Write-Host @"
╔══════════════════════════════════════════════════════════════╗
║          PROJECT HORIZON — ACR Gateway Tester                ║
║  Target: $Endpoint
╚══════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Blue

# ── Step 1: Health check ──────────────────────────────────────────────────────
Write-Host "`n[1/3] Preflight health check..." -ForegroundColor Cyan
try {
    $health = Invoke-RestMethod -Uri "$GatewayUrl/webhook/health" -Method Get -TimeoutSec 5
    Write-Host "      [OK] Gateway online: $($health.service)" -ForegroundColor Green
} catch {
    Write-Host "      [WARN] Health check failed — server may be offline: $_" -ForegroundColor Yellow
    Write-Host "      Proceeding anyway..."
}

# ── Step 2: Prepare audio file ────────────────────────────────────────────────
Write-Host "`n[2/3] Preparing audio payload..." -ForegroundColor Cyan

$TempAudio = ""
if (-not $AudioPath -or -not (Test-Path $AudioPath)) {
    # Generate a minimal valid WAV file (44 bytes header + silence)
    $TempAudio = [System.IO.Path]::GetTempFileName() + ".wav"
    $wavHeader = [byte[]](
        0x52,0x49,0x46,0x46, # "RIFF"
        0x24,0x00,0x00,0x00, # chunk size
        0x57,0x41,0x56,0x45, # "WAVE"
        0x66,0x6D,0x74,0x20, # "fmt "
        0x10,0x00,0x00,0x00, # subchunk1 size = 16
        0x01,0x00,           # PCM
        0x01,0x00,           # mono
        0x44,0xAC,0x00,0x00, # 44100 Hz
        0x88,0x58,0x01,0x00, # byte rate
        0x02,0x00,           # block align
        0x10,0x00,           # bits per sample = 16
        0x64,0x61,0x74,0x61, # "data"
        0x00,0x00,0x00,0x00  # data size = 0 (silence)
    )
    [System.IO.File]::WriteAllBytes($TempAudio, $wavHeader)
    $AudioPath = $TempAudio
    Write-Host "      [OK] Generated silent test WAV: $AudioPath" -ForegroundColor Green
} else {
    Write-Host "      [OK] Using provided file: $AudioPath" -ForegroundColor Green
}

# ── Step 3: Send multipart POST ───────────────────────────────────────────────
Write-Host "`n[3/3] Sending ACR handshake to gateway..." -ForegroundColor Cyan

$TestPhoneNumber = "+15550199"
$TestTimestamp   = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()

$Form = @{
    Secret   = "magicalbluetuba"
    Source   = "Incoming"
    Number   = $TestPhoneNumber
    Date     = "$TestTimestamp"
    Duration = "45"
    Note     = "Test call from Test-Gateway.ps1"
    File     = Get-Item -Path $AudioPath
}

try {
    $Response = Invoke-RestMethod `
        -Uri     $Endpoint `
        -Method  Post `
        -Form    $Form `
        -TimeoutSec 15

    Write-Host "`n╔══ HANDSHAKE RESULT ══════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "  Status : $($Response.status)" -ForegroundColor Green
    Write-Host "  Call ID: $($Response.call_id)" -ForegroundColor Green
    Write-Host "  Message: $($Response.message)" -ForegroundColor Green
    Write-Host "╚═══════════════════════════════════════════════════════════════╝" -ForegroundColor Green

    # Poll status
    Start-Sleep -Seconds 2
    Write-Host "`n[Bonus] Checking job status..." -ForegroundColor Cyan
    try {
        $Status = Invoke-RestMethod `
            -Uri "$GatewayUrl/api/Recording/status/$($Response.call_id)" `
            -Method Get `
            -TimeoutSec 5
        Write-Host "  Job Status: $($Status.status)" -ForegroundColor Cyan
    } catch {
        Write-Host "  Status check skipped: $_" -ForegroundColor Gray
    }

} catch {
    Write-Host "`n[FAIL] Handshake failed: $_" -ForegroundColor Red
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode
        Write-Host "  HTTP Status: $statusCode" -ForegroundColor Red
    }
} finally {
    # Clean up temp file
    if ($TempAudio -and (Test-Path $TempAudio)) {
        Remove-Item $TempAudio -Force
    }
}
