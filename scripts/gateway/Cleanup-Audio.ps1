<#
.SYNOPSIS
    Cleanup-Audio.ps1 — Removes processed audio recordings to free drive space.

.DESCRIPTION
    Scans the recordings/ directory for audio files (.mp3, .m4a, .wav, .ogg).
    For each file, checks if a matching .json transcript exists in transcripts/.
    Only deletes the audio file when the transcript is confirmed.

    Run this as a scheduled task (e.g. daily) to keep the 2TB drive clear.

.PARAMETER AudioDir
    Path to the directory containing raw audio files. Default: recordings/

.PARAMETER TranscriptDir
    Path to the directory containing JSON transcripts. Default: transcripts/

.PARAMETER DryRun
    If specified, only prints what WOULD be deleted without actually deleting.

.EXAMPLE
    # Live run
    .\scripts\Cleanup-Audio.ps1

    # Preview what would be cleaned
    .\scripts\Cleanup-Audio.ps1 -DryRun

    # Custom directories
    .\scripts\Cleanup-Audio.ps1 -AudioDir "C:\recordings" -TranscriptDir "C:\transcripts"
#>

param(
    [string] $AudioDir      = (Join-Path $PSScriptRoot "..\mcp-backend\recordings"),
    [string] $TranscriptDir = (Join-Path $PSScriptRoot "..\mcp-backend\transcripts"),
    [switch] $DryRun
)

$AudioDir      = Resolve-Path $AudioDir      -ErrorAction SilentlyContinue
$TranscriptDir = Resolve-Path $TranscriptDir -ErrorAction SilentlyContinue

Write-Host @"
╔══════════════════════════════════════════════════════════════╗
║        PROJECT HORIZON — Audio Cleanup Script                ║
║  Audio    : $AudioDir
║  Transcripts: $TranscriptDir
║  Mode     : $(if ($DryRun) { 'DRY RUN (nothing deleted)' } else { 'LIVE (files will be deleted)' })
╚══════════════════════════════════════════════════════════════╝
"@ -ForegroundColor $(if ($DryRun) { 'Yellow' } else { 'Blue' })

if (-not $AudioDir) {
    Write-Host "[ERROR] Audio directory not found. Aborting." -ForegroundColor Red
    exit 1
}
if (-not $TranscriptDir) {
    Write-Host "[WARN] Transcript directory not found — nothing to clean up yet." -ForegroundColor Yellow
    exit 0
}

$AudioExtensions = @("*.mp3", "*.m4a", "*.wav", "*.ogg", "*.aac", "*.opus")
$deleted = 0
$skipped = 0
$protected = 0

foreach ($ext in $AudioExtensions) {
    Get-ChildItem -Path $AudioDir -Filter $ext -ErrorAction SilentlyContinue | ForEach-Object {
        $baseName      = $_.BaseName
        $transcriptFile = Join-Path $TranscriptDir "$baseName.json"

        if (Test-Path $transcriptFile) {
            # Verify the transcript is "COMPLETED" (not an error stub)
            try {
                $json = Get-Content $transcriptFile -Raw | ConvertFrom-Json
                $hasTranscript = $json.transcript -and $json.transcript.Count -gt 0
            } catch {
                $hasTranscript = $false
            }

            if ($hasTranscript) {
                $sizeMB = [math]::Round($_.Length / 1MB, 2)
                if ($DryRun) {
                    Write-Host "  [DRY] Would delete: $($_.Name) ($sizeMB MB)" -ForegroundColor Yellow
                } else {
                    Remove-Item $_.FullName -Force
                    Write-Host "  [DEL] $($_.Name) ($sizeMB MB)" -ForegroundColor Green
                }
                $deleted++
            } else {
                Write-Host "  [SKIP] $($_.Name) — transcript exists but appears empty/invalid" -ForegroundColor Gray
                $skipped++
            }
        } else {
            # No transcript yet — do NOT delete
            Write-Host "  [KEEP] $($_.Name) — transcript not yet created" -ForegroundColor Cyan
            $protected++
        }
    }
}

Write-Host @"

  Results: $deleted deleted, $skipped skipped, $protected protected
$(if ($DryRun) { "  (DRY RUN — no files were actually deleted)" } else { "  Cleanup complete." })
"@ -ForegroundColor $(if ($DryRun) { 'Yellow' } else { 'Green' })
