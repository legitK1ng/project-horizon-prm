# Pyannote Speaker Diarization for ACR Phone

This guide shows you how to build a FastAPI server that accepts ACR's audio upload,
transcribes it with Whisper, adds speaker labels via pyannote, and returns the result
in the format ACR expects.

---

## Prerequisites

1. **Hugging Face account** — pyannote models are gated; you must accept the license.
   - Accept license for `pyannote/speaker-diarization-3.1` at:
     https://huggingface.co/pyannote/speaker-diarization-3.1
   - Accept license for `pyannote/segmentation-3.0` at:
     https://huggingface.co/pyannote/segmentation-3.0
   - Create a HF access token at: https://huggingface.co/settings/tokens

2. **Python 3.10+** with a GPU strongly recommended (NVIDIA, 6+ GB VRAM for medium model)

3. **ffmpeg** installed on the system (`apt install ffmpeg` / `brew install ffmpeg`)

---

## Installation

```bash
pip install fastapi uvicorn python-multipart
pip install openai-whisper torch torchaudio
pip install pyannote.audio
pip install ffmpeg-python
```

Or with WhisperX (better word-level timestamp alignment, easier diarization merging):

```bash
pip install fastapi uvicorn python-multipart
pip install whisperx
pip install pyannote.audio
```

---

## The Server (WhisperX approach — recommended)

Save as `server.py`:

```python
import os
import tempfile
import json
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import JSONResponse
import whisperx
from pyannote.audio import Pipeline
import torch

app = FastAPI()

# --- Configuration ---
HF_TOKEN = os.environ.get("HF_TOKEN", "your_huggingface_token_here")
WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "medium")  # tiny/base/small/medium/large-v3
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
COMPUTE_TYPE = "float16" if DEVICE == "cuda" else "int8"

print(f"Loading Whisper model: {WHISPER_MODEL} on {DEVICE}")
whisper_model = whisperx.load_model(WHISPER_MODEL, DEVICE, compute_type=COMPUTE_TYPE)

print("Loading pyannote diarization pipeline...")
diarization_pipeline = Pipeline.from_pretrained(
    "pyannote/speaker-diarization-3.1",
    use_auth_token=HF_TOKEN
)
if DEVICE == "cuda":
    diarization_pipeline = diarization_pipeline.to(torch.device("cuda"))

print("Ready.")


def merge_transcript_with_diarization(transcript_segments, diarization_result):
    """
    Merge Whisper word-level segments with pyannote speaker turns.
    Strategy: for each Whisper segment, find the pyannote speaker turn with
    greatest temporal overlap.
    """
    # Build list of (start, end, speaker) from pyannote output
    speaker_turns = []
    for turn, _, speaker in diarization_result.itertracks(yield_label=True):
        speaker_turns.append((turn.start, turn.end, speaker))

    def get_speaker_for_segment(seg_start, seg_end):
        best_speaker = "SPEAKER_00"
        best_overlap = 0.0
        for turn_start, turn_end, speaker in speaker_turns:
            overlap = max(0, min(seg_end, turn_end) - max(seg_start, turn_start))
            if overlap > best_overlap:
                best_overlap = overlap
                best_speaker = speaker
        return best_speaker

    # Build speaker-labeled lines, merging consecutive same-speaker segments
    labeled_lines = []
    current_speaker = None
    current_text = []

    for seg in transcript_segments:
        speaker = get_speaker_for_segment(seg["start"], seg["end"])
        if speaker != current_speaker:
            if current_speaker is not None and current_text:
                labeled_lines.append(f"{current_speaker}: {''.join(current_text).strip()}")
            current_speaker = speaker
            current_text = [seg["text"]]
        else:
            current_text.append(seg["text"])

    if current_speaker and current_text:
        labeled_lines.append(f"{current_speaker}: {''.join(current_text).strip()}")

    return "\n".join(labeled_lines)


@app.post("/v1/audio/transcriptions")
async def transcribe(
    file: UploadFile = File(...),
    model: str = Form(default="whisper-1"),
    language: str = Form(default=None),
    response_format: str = Form(default="json"),
):
    # Save uploaded audio to temp file
    suffix = os.path.splitext(file.filename or "audio.m4a")[1] or ".m4a"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        # Step 1: Transcribe with WhisperX (gives word-level timestamps)
        audio = whisperx.load_audio(tmp_path)
        transcribe_kwargs = {"batch_size": 16}
        if language:
            transcribe_kwargs["language"] = language

        result = whisper_model.transcribe(audio, **transcribe_kwargs)
        detected_language = result.get("language", "en")

        # Step 2: Align for word-level timestamps
        align_model, metadata = whisperx.load_align_model(
            language_code=detected_language, device=DEVICE
        )
        result = whisperx.align(
            result["segments"], align_model, metadata, audio, DEVICE,
            return_char_alignments=False
        )

        # Step 3: Diarize
        diarization_result = diarization_pipeline(
            {"waveform": torch.from_numpy(audio).unsqueeze(0), "sample_rate": 16000}
        )

        # Step 4: Assign speakers to words
        result = whisperx.assign_word_speakers(diarization_result, result)

        # Step 5: Merge into readable speaker-labeled transcript
        labeled_text = merge_transcript_with_diarization(
            result["segments"], diarization_result
        )

        return JSONResponse({"text": labeled_text})

    finally:
        os.unlink(tmp_path)


@app.get("/v1/models")
async def list_models():
    """ACR and some clients check this endpoint for compatibility."""
    return {"object": "list", "data": [{"id": "whisper-1", "object": "model"}]}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

---

## Running the Server

```bash
# Set your HF token as an env var (safer than hardcoding)
export HF_TOKEN="hf_your_token_here"
export WHISPER_MODEL="medium"   # or large-v3 for best quality

python server.py
```

Server starts at `http://0.0.0.0:8000`

In ACR Phone → Cloud Services → OpenAI Whisper:
- **Provider**: Custom
- **Host**: `http://YOUR_SERVER_IP:8000/v1/`
- **API Key**: `dummy` (required by ACR UI but ignored by this server)

---

## Running with Docker

Create `Dockerfile`:

```dockerfile
FROM python:3.11-slim

RUN apt-get update && apt-get install -y ffmpeg git && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN pip install fastapi uvicorn python-multipart whisperx pyannote.audio torch torchaudio \
    --extra-index-url https://download.pytorch.org/whl/cu118

COPY server.py .

ENV HF_TOKEN=""
ENV WHISPER_MODEL="medium"

CMD ["python", "server.py"]
```

```bash
docker build -t acr-whisper-diarize .
docker run -d \
  --gpus all \
  -p 8000:8000 \
  -e HF_TOKEN="hf_your_token" \
  -e WHISPER_MODEL="medium" \
  acr-whisper-diarize
```

---

## What the Output Looks Like in ACR

ACR saves the transcript as a note on the recording. With diarization, it reads:

```
SPEAKER_00: Hey, thanks for calling. How can I help you today?
SPEAKER_01: Yeah hi, I wanted to ask about the appointment on Thursday.
SPEAKER_00: Sure, let me pull that up. What's your name?
SPEAKER_01: It's Sarah.
```

Speaker labels are `SPEAKER_00`, `SPEAKER_01`, etc. — pyannote doesn't know names, just that these are different voices. Users can manually rename them after reading.

---

## Troubleshooting

**"Model not found" error from pyannote:**
→ You haven't accepted the license on HuggingFace. Visit both model pages and click Accept.

**"CUDA out of memory":**
→ Reduce `WHISPER_MODEL` to `small` or `base`, or set `COMPUTE_TYPE = "int8"` for CPU.

**Speakers all labeled SPEAKER_00:**
→ Audio may be mono with low quality or only one speaker actually speaking. Check with a clear stereo call recording.

**Server is slow (30+ seconds per recording):**
→ CPU mode is expected to be slow. A GPU reduces processing time significantly.
→ For CPU-only use, `small` or `base` model is more practical than `medium`.

**ACR gets back text but no speaker labels:**
→ The merge function may be failing silently. Check server logs for errors during the diarization step.
