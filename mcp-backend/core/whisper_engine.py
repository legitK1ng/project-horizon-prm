"""
Whisper Engine — AGENT-3a
Optimized for speed and VRAM: tiny model with int8_float16 quantization.
"""
import os
import sys
import torch
from faster_whisper import WhisperModel

_whisper_model = None

def init_whisper():
    """Initialize Whisper model with CUDA if available, else CPU."""
    global _whisper_model
    print("[AI] Loading Faster-Whisper model...", flush=True)
    try:
        # tiny model for low latency
        _whisper_model = WhisperModel("tiny", device="cuda" if torch.cuda.is_available() else "cpu", 
                                     compute_type="int8_float16" if torch.cuda.is_available() else "int8")
    except Exception as e:
        print(f"[AI] Warning: CUDA Faster-Whisper failed, falling back to CPU: {e}", flush=True)
        _whisper_model = WhisperModel("tiny", device="cpu", compute_type="int8")
    
    print(f"[AI] Whisper: {'SUCCESS' if _whisper_model else 'FAILED'}", flush=True)
    return _whisper_model

def transcribe(audio_path: str) -> list:
    """Transcribe audio file into segments."""
    if _whisper_model is None:
        raise RuntimeError("Whisper model not initialized. Call init_whisper() first.")
    
    print(f"[AI] Starting Whisper transcription for {audio_path}", flush=True)
    segments, _ = _whisper_model.transcribe(audio_path, beam_size=5)
    return list(segments)
