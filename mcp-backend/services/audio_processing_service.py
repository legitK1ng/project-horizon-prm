import subprocess
import uuid
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# REQ-025: Temporary storage rotation
# Use absolute paths to avoid ambiguity on Windows/Linux environments
BASE_DIR = Path(__file__).resolve().parent.parent
TEMP_DIR = BASE_DIR / "audio_ingest" / "temp"
TEMP_DIR.mkdir(parents=True, exist_ok=True)


def _extract_ffmpeg_error(stderr: str) -> str:
    """Return only the meaningful tail of FFmpeg's verbose stderr output."""
    preamble_prefixes = (
        "ffmpeg version", "  configuration:", "  built with",
        "  lib", "    lib", "Copyright (c)",
    )
    lines = stderr.strip().splitlines()
    meaningful = [
        l for l in lines
        if l.strip() and not any(l.startswith(p) for p in preamble_prefixes)
    ]
    tail = meaningful[-10:] if meaningful else lines[-10:]
    return "\n".join(tail) if tail else stderr[-500:]


def process_audio_ingest(audio_content: bytes, filename: str) -> str:
    """
    REQ-155: FFmpeg normalization pipeline (16kHz mono).
    Sync — callers from async handlers must run this in a thread executor.
    1. Saves incoming bytes to a temporary file.
    2. Converts to 16kHz mono PCM WAV for Whisper.
    3. Returns path to the .wav file.
    """
    job_id = str(uuid.uuid4())
    input_ext = Path(filename).suffix or ".m4a"
    input_path = TEMP_DIR / f"{job_id}_raw{input_ext}"
    output_path = TEMP_DIR / f"{job_id}_final.wav"

    try:
        with open(input_path, "wb") as f:
            f.write(audio_content)

        logger.info(f"[AUDIO] Saved raw file: {input_path} ({len(audio_content):,} bytes)")

        command = [
            "ffmpeg", "-y", "-hide_banner",
            "-i", str(input_path),
            "-ar", "16000",
            "-ac", "1",
            "-c:a", "pcm_s16le",
            str(output_path),
        ]

        logger.info(f"[AUDIO] Converting to WAV: {' '.join(command)}")
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )

        if result.returncode != 0:
            error_summary = _extract_ffmpeg_error(result.stderr)
            logger.error(f"[AUDIO] FFmpeg failed (rc={result.returncode}):\n{result.stderr}")
            raise RuntimeError(f"FFmpeg conversion failed: {error_summary}")

        if input_path.exists():
            input_path.unlink()

        return str(output_path)

    except Exception as e:
        logger.error(f"[AUDIO] Processing error: {e}")
        if input_path.exists():
            input_path.unlink()
        if output_path.exists():
            output_path.unlink()
        raise

def cleanup_processed_audio(wav_path: str):
    """
    REQ-025: Deletes the temporary .wav file once processing is complete.
    """
    path = Path(wav_path)
    if path.exists():
        path.unlink()
        logger.info(f"[AUDIO] Cleaned up temporary file: {wav_path}")
