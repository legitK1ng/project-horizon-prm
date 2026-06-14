import os
import logging
from typing import Optional
from faster_whisper import WhisperModel

logger = logging.getLogger(__name__)

# Type alias for the transcription return value
_TranscribeResult = tuple[str, list, str, float]

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
            device = "cpu"
            model_size = os.getenv("WHISPER_MODEL_SIZE", "tiny")
            logger.info(f"[WHISPER] Loading model: {model_size} on {device}...")
            self._model = WhisperModel(model_size, device=device, compute_type="int8")
            logger.info("[WHISPER] Model loaded successfully.")
        return self._model

    def run_transcription(
        self,
        wav_path: str,
        language: str = "en",
        prompt: str = "",
        temperature: float = 0.0,
    ) -> _TranscribeResult:
        """
        Execute Faster-Whisper transcription on a normalized WAV file.
        Returns (full_text, segments_list, detected_language, audio_duration_seconds).

        This is the canonical entry point for transcription, called by:
          - routers/transcriptions.py (ACR webhook ingest path)
          - core/sentinel.py (retry/self-healing path)

        Moved from routers/transcriptions._run_transcription() in PATCH-05 (C9)
        to break the router→daemon coupling.
        """
        model = self.get_model()

        kwargs: dict = dict(
            beam_size=5,
            language=language or None,
            temperature=temperature,
            vad_filter=True,
            vad_parameters=dict(
                min_silence_duration_ms=500,
                speech_pad_ms=200,
            ),
            condition_on_previous_text=False,
            no_speech_threshold=0.6,
            compression_ratio_threshold=2.4,
        )
        if prompt:
            kwargs["initial_prompt"] = prompt

        seg_gen, info = model.transcribe(wav_path, **kwargs)

        segments = list(seg_gen)
        segments = [s for s in segments if getattr(s, "no_speech_prob", 0.0) < 0.8]

        segments_list = [
            {
                "id": i,
                "seek": getattr(s, "seek", 0),
                "start": s.start,
                "end": s.end,
                "text": s.text,
                "tokens": getattr(s, "tokens", []),
                "temperature": getattr(s, "temperature", 0.0),
                "avg_logprob": getattr(s, "avg_logprob", 0.0),
                "compression_ratio": getattr(s, "compression_ratio", 0.0),
                "no_speech_prob": getattr(s, "no_speech_prob", 0.0),
            }
            for i, s in enumerate(segments)
        ]

        full_text = " ".join(seg.text.strip() for seg in segments)
        return full_text, segments_list, info.language, info.duration

def transcribe_audio(wav_path: str) -> str:
    """
    REQ-151: Perform transcription on a locally normalized .wav file.
    Uses identical parameters to _run_transcription() in routers/transcriptions.py
    so that calls.py (batch ingest) and the ACR webhook produce equivalent quality output.

    Parameters match CONSTITUTION Section 7:
      beam_size=5, vad_filter=True, condition_on_previous_text=False,
      no_speech_threshold=0.6, compression_ratio_threshold=2.4.
    """
    manager = TranscriptionManager()
    model = manager.get_model()

    logger.info(f"[WHISPER] Transcribing: {wav_path}")

    seg_gen, info = model.transcribe(
        wav_path,
        beam_size=5,
        language="en",
        vad_filter=True,
        vad_parameters=dict(
            min_silence_duration_ms=500,
            speech_pad_ms=200,
        ),
        condition_on_previous_text=False,
        no_speech_threshold=0.6,
        compression_ratio_threshold=2.4,
    )

    segments = list(seg_gen)
    # Drop hallucinated silence segments post-VAD
    segments = [s for s in segments if getattr(s, "no_speech_prob", 0.0) < 0.8]
    full_text = " ".join(s.text.strip() for s in segments)

    logger.info(f"[WHISPER] Transcription complete. Length: {len(full_text)} chars.")
    return full_text
