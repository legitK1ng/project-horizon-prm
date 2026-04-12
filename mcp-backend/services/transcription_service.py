import os
import logging
from typing import Optional
from faster_whisper import WhisperModel

logger = logging.getLogger(__name__)

class TranscriptionManager:
    """
    REQ-151: Singleton Manager for the Whisper Model.
    Ensures the model is only loaded into memory once.
    """
    _instance: Optional['TranscriptionManager'] = None
    _model: Optional[WhisperModel] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(TranscriptionManager, cls).__new__(cls)
        return cls._instance

    def get_model(self) -> WhisperModel:
        if self._model is None:
            # Determine device based on availability
            device = "cpu" # Default for stability on varied hardware
            # In production, we'd check for CUDA
            # device = "cuda" if torch.cuda.is_available() else "cpu"
            
            # REQ-151: Default to 'tiny' for speed (avoids mobile timeouts).
            # Users can override via env WHISPER_MODEL_SIZE.
            model_size = os.getenv("WHISPER_MODEL_SIZE", "tiny")
            logger.info(f"[WHISPER] Loading model: {model_size} on {device}...")
            
            self._model = WhisperModel(model_size, device=device, compute_type="int8")
            logger.info(f"[WHISPER] Model loaded successfully.")
            
        return self._model

def transcribe_audio(wav_path: str) -> str:
    """
    REQ-151: Perform transcription on a locally normalized .wav file.
    """
    manager = TranscriptionManager()
    model = manager.get_model()
    
    logger.info(f"[WHISPER] Transcribing: {wav_path}")
    
    # beam_size=5 is the default for a good trade-off.
    segments, info = model.transcribe(wav_path, beam_size=5, language="en")
    
    # Process segments generator
    text_segments = []
    for segment in segments:
        text_segments.append(segment.text.strip())
        
    full_text = " ".join(text_segments)
    logger.info(f"[WHISPER] Transcription complete. Length: {len(full_text)} chars.")
    
    return full_text
