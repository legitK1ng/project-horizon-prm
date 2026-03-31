"""
Diarization Engine — AGENT-3a
Pyannote Speaker Diarization pipeline with Windows patches support.
"""
import os
import sys
import torch
import io
from contextlib import redirect_stderr
from pyannote.audio import Pipeline

_diarization_pipeline = None

def init_diarization():
    """Initialize Pyannote diarization pipeline with CUDA if available."""
    global _diarization_pipeline
    
    # We MUST ensure the Windows patches are applied before loading the pipeline
    from core.windows_patches import apply_windows_patches
    apply_windows_patches()
    
    token = os.environ.get("HUGGINGFACE_TOKEN")
    if not token:
        print("[AI] Warning: HUGGINGFACE_TOKEN not found in environment.", file=sys.stderr)
    else:
        print(f"[AI] Loading Pyannote Diarization pipeline (token: {token[:10]}...)", flush=True)
    
    try:
        with redirect_stderr(io.StringIO()):
            _diarization_pipeline = Pipeline.from_pretrained(
                "pyannote/speaker-diarization-3.1", 
                token=token
            )
        if torch.cuda.is_available():
            _diarization_pipeline.to(torch.device("cuda"))
    except Exception as e:
        print(f"[AI] Warning: Failed to load Pyannote pipeline: {e}", file=sys.stderr)
        _diarization_pipeline = None
    
    print(f"[AI] Diarization: {'SUCCESS' if _diarization_pipeline else 'FAILED'}", flush=True)
    return _diarization_pipeline

def diarize(audio_path: str):
    """Perform speaker diarization on audio file."""
    if _diarization_pipeline is None:
        raise RuntimeError("Diarization pipeline not initialized. Call init_diarization() first.")
    
    print(f"[AI] Starting Pyannote diarization for {audio_path}", flush=True)
    return _diarization_pipeline(audio_path)
