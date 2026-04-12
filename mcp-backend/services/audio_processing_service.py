import os
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

def process_audio_ingest(audio_content: bytes, filename: str) -> str:
    """
    REQ-155: FFmpeg normalization pipeline (16kHz mono).
    1. Saves incoming bytes to temporary .m4a.
    2. Converts to .wav for high-fidelity transcription (REQ-151).
    3. Returns path to .wav.
    """
    job_id = str(uuid.uuid4())
    # Ensure input and output paths are ALWAYS distinct to prevent FFmpeg collision
    input_ext = Path(filename).suffix or ".m4a"
    input_path = TEMP_DIR / f"{job_id}_raw{input_ext}"
    output_path = TEMP_DIR / f"{job_id}_final.wav"

    try:
        # 1. Save raw bytes (REQ-024)
        with open(input_path, "wb") as f:
            f.write(audio_content)
        
        logger.info(f"[AUDIO] Saved raw file: {input_path}")

        # 2. Convert to WAV (16kHz, Mono, PCM) - REQ-155
        # Standard format for Whisper and NeMo diarization.
        command = [
            "ffmpeg",
            "-y", # Overwrite if exists
            "-i", str(input_path),
            "-ar", "16000",
            "-ac", "1",
            "-c:a", "pcm_s16le",
            str(output_path)
        ]
        
        logger.info(f"[AUDIO] Converting to WAV: {' '.join(command)}")
        result = subprocess.run(command, capture_output=True, text=True)
        
        if result.returncode != 0:
            logger.error(f"[AUDIO] FFmpeg failed: {result.stderr}")
            raise RuntimeError(f"FFmpeg conversion failed: {result.stderr}")

        # 3. Cleanup raw file immediately
        if input_path.exists():
            input_path.unlink()
            
        return str(output_path)

    except Exception as e:
        logger.error(f"[AUDIO] Processing error: {e}")
        # Cleanup on failure
        if input_path.exists(): input_path.unlink()
        if output_path.exists(): output_path.unlink()
        raise e

def cleanup_processed_audio(wav_path: str):
    """
    REQ-025: Deletes the temporary .wav file once processing is complete.
    """
    path = Path(wav_path)
    if path.exists():
        path.unlink()
        logger.info(f"[AUDIO] Cleaned up temporary file: {wav_path}")
