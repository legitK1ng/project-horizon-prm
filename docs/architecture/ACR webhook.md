To help you process the transcription hand-off from ACR Phone to a service like OpenAI Whisper, I've analyzed the [ACRPhoneWebHook](https://github.com/NLLAPPS/ACRPhoneWebHook) repository.

This repository serves as a **reference implementation** for a web server designed to receive data from ACR Phone's cloud webhook feature. Since you are looking to integrate Whisper, here is what is useful in this repo to facilitate that "handshake":

I've compiled the core references from the to support our transcription hand-off strategy. Since the goal is to make the document professional and self-contained for the team, I have categorized the essential files with their direct URLs and provided the complete source code for the two most critical components.

### **1\. Request Structure (The "Handshake")**

The most critical part of the repo for you is the **Controller logic**, which defines how your server should listen for incoming data.

* **Endpoint Identification:** Look at the files in the Controllers directory. They define the API endpoints where the app sends call data (metadata and audio file links/blobs).  
* **Authentication:** The Authentication folder contains the logic for verifying that the requests are actually coming from your app, ensuring the hand-off is secure.

### **2\. Data Models (The "Payload")**

The Models folder defines the C\# classes that match the JSON payload sent by ACR Phone. To process this properly, you'll need to know:

* **Call Metadata:** Fields for phone numbers, timestamps, and call duration.  
* **Audio Source:** How the app provides the recording (e.g., a direct file upload or a URL to a recording). This is what you will "hand off" to the OpenAI Whisper v1/audio/transcriptions endpoint.

### **3\. Implementation Strategy for Whisper**

Based on this repo's structure, your workflow would look like this:

1. **Receive:** Your server (based on the Controllers in the repo) receives the webhook post-call.  
2. **Extract:** Your code extracts the audio file link or byte array from the Models.  
3. **Handoff:** Instead of just saving to a database (which this sample repo demonstrates), you would add a service call to OpenAI's API.  
4. **Process:** Send the audio data to Whisper:  
   $$\\text{ACR Webhook} \\rightarrow \\text{Your Server} \\rightarrow \\text{OpenAI Whisper API} \\rightarrow \\text{Final Transcription}$$

### **4\. What's Missing**

Note that this repository is a **generic receiver**. It does **not** contain the specific OpenAI Whisper API integration code. It only provides the "entry point" and "data structure" needed to get the audio out of the ACR ecosystem and into your own processing pipeline.

### **5\. Core References and Implementation Details**

**Reference Links for Documentation**
For a deep dive into the service architecture, these are the primary endpoints and logic definitions in the repository:

* **Logic Hub:** — Handles the POST upload from the app.  
* **The Data Payload:** — Defines the "Handshake" fields.  
* **Output Formatter:** — How the data is structured for downstream consumption.  
* **Security Protocol:** — Manages the secret-key verification.

**Core Implementation Code**
Below is the full code for the two files that define how we receive the audio. We can reference these directly when we start writing the proxy service for OpenAI.

**1\. The Handshake Model (UploadRecordViewModel.cs)**This file is our blueprint. It tells us exactly what the phone app is going to send us in the multipart form.

```c#
using Microsoft.AspNetCore.Http;
using System;

namespace ACRPhoneWebHook.ViewModels
{
    // This model represents the "Handshake" payload sent by the ACR Phone app.
    public class UploadRecordViewModel
    {
        // The secret key used to authenticate the device
        public string Secret { get; set; }

        // Metadata about the call source (e.g., Incoming/Outgoing)
        public string Source { get; set; }

        // The phone number associated with the recording
        public string Number { get; set; }

        // Unix timestamp of the call
        public long? Date { get; set; }

        // Duration of the call in seconds
        public int? Duration { get; set; }

        // Any notes attached to the recording
        public string Note { get; set; }

        // The actual binary audio file (.mp3, .m4a, etc.)
        public IFormFile File { get; set; }
    }
}
```

**2\. The Receiver Logic (RecordingController.cs \- Upload Excerpt)**This is the functional "Catcher." It validates the secret and extracts the file buffer which we will eventually pipe to Whisper.

\[HttpPost("upload")\]

\[RequestFormLimits(MultipartBodyLengthLimit \= 2147483647)\] // Support for large audio files

public async Task\<IActionResult\> Upload(\[FromForm\] UploadRecordViewModel model)

{

    // 1\. Security Check: Validate the secret handshake

    if (\!string.IsNullOrWhiteSpace(model.Secret) && model.Secret \!= appSettings.UserCredentials.Secret)

    {

        return StatusCode(401, "Invalid Secret");

    }

    try

    {

        if (model.File \!= null)

        {

            var file \= model.File;

            var safeFileName \= SafeFileName(file.FileName);

            var filePath \= Path.Combine(GetUploadPath(), safeFileName);

            // 2\. The Handoff: Currently saves to disk, but our version will stream to OpenAI here

            using var stream \= new FileStream(filePath, FileMode.Create);

            await file.CopyToAsync(stream);

        }

        return Ok();

    }

    catch (Exception e)

    {

        return StatusCode(500, "Error during handoff");

    }

}

---

**Fact check**

```python
import os
import time
import uuid
import shutil
import logging
import json
from typing import Optional, List, Dict
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from pydantic import BaseModel
import torch
from faster_whisper import WhisperModel
from pyannote.audio import Pipeline

# --- CONFIGURATION ---
ACR_SECRET = "your_secure_handshake_secret" 
HF_TOKEN = "your_huggingface_token_here" 
UPLOAD_DIR = "recordings"
TRANSCRIPT_DIR = "transcripts"

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(TRANSCRIPT_DIR, exist_ok=True)

app = FastAPI(title="ACR Phone Transcription Gateway")
logging.basicConfig(level=logging.INFO)

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# --- DOCUMENTATION: JSON SCHEMA ---
"""
INPUT (FROM ACR APP):
The app sends a 'multipart/form-data' POST. Logically, it maps to:
{
    "secret": "string",
    "source": "Incoming/Outgoing",
    "number": "+123456789",
    "date": 1712345678,
    "duration": 120,
    "note": "Initial user note",
    "file": [BINARY_AUDIO_DATA]
}

OUTPUT (GENERATED BY THIS SCRIPT):
Saved as {date}_{number}.json:
{
    "metadata": { "number": "+123456789", "date": 1712345678, ... },
    "transcript": [
        { "speaker": "SPEAKER_00", "start": 0.5, "end": 4.2, "text": "Hello, how can I help you?" },
        { "speaker": "SPEAKER_01", "start": 4.5, "end": 6.0, "text": "I have a question about my bill." }
    ]
}
"""

async def sync_transcript_to_app(number: str, transcript_text: str):
    """
    EXPERIMENTAL: Syncing back to the app notes field.
    Most Webhooks are 1-way. To update the app's notes, we would typically 
    need to target a secondary API if ACR provides one for remote updates.
    """
    logging.info(f"Attempting to sync transcript back to device for {number}...")
    # This is a placeholder for the logic required if the developer 
    # provides a PUT/PATCH endpoint for the app's local database.
    pass

def process_audio(file_path: str, call_id: str, metadata: dict):
    try:
        logging.info(f"Starting AI Pipeline for {call_id}...")

        # STEP 1: DIARIZATION
        diarize_pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1", 
            use_auth_token=HF_TOKEN
        ).to(torch.device(DEVICE))
        
        diarization = diarize_pipeline(file_path)
        del diarize_pipeline
        if DEVICE == "cuda": torch.cuda.empty_cache()

        # STEP 2: TRANSCRIPTION
        whisper_model = WhisperModel("tiny.en", device=DEVICE, compute_type="int8_float16")
        segments, _ = whisper_model.transcribe(file_path, beam_size=5, word_timestamps=True)
        
        segments = list(segments)
        full_text_list = []

        # STEP 3: ALIGNMENT
        final_transcript = []
        for segment in segments:
            midpoint = (segment.start + segment.end) / 2
            speaker = "Unknown"
            for turn, _, lab in diarization.itertracks(yield_label=True):
                if turn.start <= midpoint <= turn.end:
                    speaker = lab
                    break
            
            entry = {
                "speaker": speaker,
                "start": round(segment.start, 2),
                "end": round(segment.end, 2),
                "text": segment.text.strip()
            }
            final_transcript.append(entry)
            full_text_list.append(f"{speaker}: {segment.text.strip()}")

        # STEP 4: SAVE & SYNC
        output_data = {"metadata": metadata, "transcript": final_transcript}
        output_file = os.path.join(TRANSCRIPT_DIR, f"{call_id}.json")
        
        with open(output_file, "w") as f:
            json.dump(output_data, f, indent=4)
            
        # Format a plain text version for the 'Notes' field
        formatted_notes = "\n".join(full_text_list)
        # In a collaborative setup, we would trigger the sync-back here
        # await sync_transcript_to_app(metadata['number'], formatted_notes)

        logging.info(f"Success. Transcript for {call_id} is ready.")

    except Exception as e:
        logging.error(f"Pipeline Failure for {call_id}: {str(e)}")
    finally:
        if DEVICE == "cuda": torch.cuda.empty_cache()

@app.post("/api/Recording/upload")
async def handle_acr_upload(
    background_tasks: BackgroundTasks,
    secret: str = Form(...),
    source: str = Form(None),
    number: str = Form(None),
    date: int = Form(None),
    duration: int = Form(None),
    note: str = Form(None),
    file: UploadFile = File(...)
):
    if secret != ACR_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized Handshake")

    call_id = f"{date}_{number}" if date and number else str(uuid.uuid4())
    ext = file.filename.split(".")[-1]
    file_path = os.path.join(UPLOAD_DIR, f"{call_id}.{ext}")

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    metadata = {
        "source": source,
        "number": number,
        "date": date,
        "duration": duration,
        "note": note,
        "received_at": time.time()
    }

    background_tasks.add_task(process_audio, file_path, call_id, metadata)

    # Return a 200 OK to the phone app immediately so it can release the connection
    return {"status": "success", "message": "Audio received for processing"}

if __name__ == "__main__":
    import uvicorn
    # Bind to all interfaces for Tailscale visibility
    uvicorn.run(app, host="0.0.0.0", port=8000)import os
import time
import uuid
import shutil
import logging
import json
from typing import Optional, List, Dict
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from pydantic import BaseModel
import torch
from faster_whisper import WhisperModel
from pyannote.audio import Pipeline

# --- CONFIGURATION ---
ACR_SECRET = "your_secure_handshake_secret" 
HF_TOKEN = "your_huggingface_token_here" 
UPLOAD_DIR = "recordings"
TRANSCRIPT_DIR = "transcripts"

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(TRANSCRIPT_DIR, exist_ok=True)

app = FastAPI(title="ACR Phone Transcription Gateway")
logging.basicConfig(level=logging.INFO)

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# --- DOCUMENTATION: JSON SCHEMA ---
"""
INPUT (FROM ACR APP):
The app sends a 'multipart/form-data' POST. Logically, it maps to:
{
    "secret": "string",
    "source": "Incoming/Outgoing",
    "number": "+123456789",
    "date": 1712345678,
    "duration": 120,
    "note": "Initial user note",
    "file": [BINARY_AUDIO_DATA]
}

OUTPUT (GENERATED BY THIS SCRIPT):
Saved as {date}_{number}.json:
{
    "metadata": { "number": "+123456789", "date": 1712345678, ... },
    "transcript": [
        { "speaker": "SPEAKER_00", "start": 0.5, "end": 4.2, "text": "Hello, how can I help you?" },
        { "speaker": "SPEAKER_01", "start": 4.5, "end": 6.0, "text": "I have a question about my bill." }
    ]
}
"""

async def sync_transcript_to_app(number: str, transcript_text: str):
    """
    EXPERIMENTAL: Syncing back to the app notes field.
    Most Webhooks are 1-way. To update the app's notes, we would typically 
    need to target a secondary API if ACR provides one for remote updates.
    """
    logging.info(f"Attempting to sync transcript back to device for {number}...")
    # This is a placeholder for the logic required if the developer 
    # provides a PUT/PATCH endpoint for the app's local database.
    pass

def process_audio(file_path: str, call_id: str, metadata: dict):
    try:
        logging.info(f"Starting AI Pipeline for {call_id}...")

        # STEP 1: DIARIZATION
        diarize_pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1", 
            use_auth_token=HF_TOKEN
        ).to(torch.device(DEVICE))
        
        diarization = diarize_pipeline(file_path)
        del diarize_pipeline
        if DEVICE == "cuda": torch.cuda.empty_cache()

        # STEP 2: TRANSCRIPTION
        whisper_model = WhisperModel("tiny.en", device=DEVICE, compute_type="int8_float16")
        segments, _ = whisper_model.transcribe(file_path, beam_size=5, word_timestamps=True)
        
        segments = list(segments)
        full_text_list = []

        # STEP 3: ALIGNMENT
        final_transcript = []
        for segment in segments:
            midpoint = (segment.start + segment.end) / 2
            speaker = "Unknown"
            for turn, _, lab in diarization.itertracks(yield_label=True):
                if turn.start <= midpoint <= turn.end:
                    speaker = lab
                    break
            
            entry = {
                "speaker": speaker,
                "start": round(segment.start, 2),
                "end": round(segment.end, 2),
                "text": segment.text.strip()
            }
            final_transcript.append(entry)
            full_text_list.append(f"{speaker}: {segment.text.strip()}")

        # STEP 4: SAVE & SYNC
        output_data = {"metadata": metadata, "transcript": final_transcript}
        output_file = os.path.join(TRANSCRIPT_DIR, f"{call_id}.json")
        
        with open(output_file, "w") as f:
            json.dump(output_data, f, indent=4)
            
        # Format a plain text version for the 'Notes' field
        formatted_notes = "\n".join(full_text_list)
        # In a collaborative setup, we would trigger the sync-back here
        # await sync_transcript_to_app(metadata['number'], formatted_notes)

        logging.info(f"Success. Transcript for {call_id} is ready.")

    except Exception as e:
        logging.error(f"Pipeline Failure for {call_id}: {str(e)}")
    finally:
        if DEVICE == "cuda": torch.cuda.empty_cache()

@app.post("/api/Recording/upload")
async def handle_acr_upload(
    background_tasks: BackgroundTasks,
    secret: str = Form(...),
    source: str = Form(None),
    number: str = Form(None),
    date: int = Form(None),
    duration: int = Form(None),
    note: str = Form(None),
    file: UploadFile = File(...)
):
    if secret != ACR_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized Handshake")

    call_id = f"{date}_{number}" if date and number else str(uuid.uuid4())
    ext = file.filename.split(".")[-1]
    file_path = os.path.join(UPLOAD_DIR, f"{call_id}.{ext}")

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    metadata = {
        "source": source,
        "number": number,
        "date": date,
        "duration": duration,
        "note": note,
        "received_at": time.time()
    }

    background_tasks.add_task(process_audio, file_path, call_id, metadata)

    # Return a 200 OK to the phone app immediately so it can release the connection
    return {"status": "success", "message": "Audio received for processing"}

if __name__ == "__main__":
    import uvicorn
    # Bind to all interfaces for Tailscale visibility
    uvicorn.run(app, host="0.0.0.0", port=8000)
import os
import time
import uuid
import shutil
import logging
import json
from typing import Optional, List, Dict
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from pydantic import BaseModel
import torch
from faster_whisper import WhisperModel
from pyannote.audio import Pipeline

# --- CONFIGURATION ---
ACR_SECRET = "your_secure_handshake_secret" 
HF_TOKEN = "your_huggingface_token_here" 
UPLOAD_DIR = "recordings"
TRANSCRIPT_DIR = "transcripts"

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(TRANSCRIPT_DIR, exist_ok=True)

app = FastAPI(title="ACR Phone Transcription Gateway")
logging.basicConfig(level=logging.INFO)

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# --- DOCUMENTATION: JSON SCHEMA ---
"""
INPUT (FROM ACR APP):
The app sends a 'multipart/form-data' POST. Logically, it maps to:
{
    "secret": "string",
    "source": "Incoming/Outgoing",
    "number": "+123456789",
    "date": 1712345678,
    "duration": 120,
    "note": "Initial user note",
    "file": [BINARY_AUDIO_DATA]
}

OUTPUT (GENERATED BY THIS SCRIPT):
Saved as {date}_{number}.json:
{
    "metadata": { "number": "+123456789", "date": 1712345678, ... },
    "transcript": [
        { "speaker": "SPEAKER_00", "start": 0.5, "end": 4.2, "text": "Hello, how can I help you?" },
        { "speaker": "SPEAKER_01", "start": 4.5, "end": 6.0, "text": "I have a question about my bill." }
    ]
}
"""

async def sync_transcript_to_app(number: str, transcript_text: str):
    """
    EXPERIMENTAL: Syncing back to the app notes field.
    Most Webhooks are 1-way. To update the app's notes, we would typically 
    need to target a secondary API if ACR provides one for remote updates.
    """
    logging.info(f"Attempting to sync transcript back to device for {number}...")
    # This is a placeholder for the logic required if the developer 
    # provides a PUT/PATCH endpoint for the app's local database.
    pass

def process_audio(file_path: str, call_id: str, metadata: dict):
    try:
        logging.info(f"Starting AI Pipeline for {call_id}...")

        # STEP 1: DIARIZATION
        diarize_pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1", 
            use_auth_token=HF_TOKEN
        ).to(torch.device(DEVICE))
        
        diarization = diarize_pipeline(file_path)
        del diarize_pipeline
        if DEVICE == "cuda": torch.cuda.empty_cache()

        # STEP 2: TRANSCRIPTION
        whisper_model = WhisperModel("tiny.en", device=DEVICE, compute_type="int8_float16")
        segments, _ = whisper_model.transcribe(file_path, beam_size=5, word_timestamps=True)
        
        segments = list(segments)
        full_text_list = []

        # STEP 3: ALIGNMENT
        final_transcript = []
        for segment in segments:
            midpoint = (segment.start + segment.end) / 2
            speaker = "Unknown"
            for turn, _, lab in diarization.itertracks(yield_label=True):
                if turn.start <= midpoint <= turn.end:
                    speaker = lab
                    break
            
            entry = {
                "speaker": speaker,
                "start": round(segment.start, 2),
                "end": round(segment.end, 2),
                "text": segment.text.strip()
            }
            final_transcript.append(entry)
            full_text_list.append(f"{speaker}: {segment.text.strip()}")

        # STEP 4: SAVE & SYNC
        output_data = {"metadata": metadata, "transcript": final_transcript}
        output_file = os.path.join(TRANSCRIPT_DIR, f"{call_id}.json")
        
        with open(output_file, "w") as f:
            json.dump(output_data, f, indent=4)
            
        # Format a plain text version for the 'Notes' field
        formatted_notes = "\n".join(full_text_list)
        # In a collaborative setup, we would trigger the sync-back here
        # await sync_transcript_to_app(metadata['number'], formatted_notes)

        logging.info(f"Success. Transcript for {call_id} is ready.")

    except Exception as e:
        logging.error(f"Pipeline Failure for {call_id}: {str(e)}")
    finally:
        if DEVICE == "cuda": torch.cuda.empty_cache()

@app.post("/api/Recording/upload")
async def handle_acr_upload(
    background_tasks: BackgroundTasks,
    secret: str = Form(...),
    source: str = Form(None),
    number: str = Form(None),
    date: int = Form(None),
    duration: int = Form(None),
    note: str = Form(None),
    file: UploadFile = File(...)
):
    if secret != ACR_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized Handshake")

    call_id = f"{date}_{number}" if date and number else str(uuid.uuid4())
    ext = file.filename.split(".")[-1]
    file_path = os.path.join(UPLOAD_DIR, f"{call_id}.{ext}")

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    metadata = {
        "source": source,
        "number": number,
        "date": date,
        "duration": duration,
        "note": note,
        "received_at": time.time()
    }

    background_tasks.add_task(process_audio, file_path, call_id, metadata)

    # Return a 200 OK to the phone app immediately so it can release the connection
    return {"status": "success", "message": "Audio received for processing"}

if __name__ == "__main__":
    import uvicorn
    # Bind to all interfaces for Tailscale visibility
    uvicorn.run(app, host="0.0.0.0", port=8000)import os
import time
import uuid
import shutil
import logging
import json
from typing import Optional, List, Dict
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from pydantic import BaseModel
import torch
from faster_whisper import WhisperModel
from pyannote.audio import Pipeline

# --- CONFIGURATION ---
ACR_SECRET = "your_secure_handshake_secret" 
HF_TOKEN = "your_huggingface_token_here" 
UPLOAD_DIR = "recordings"
TRANSCRIPT_DIR = "transcripts"

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(TRANSCRIPT_DIR, exist_ok=True)

app = FastAPI(title="ACR Phone Transcription Gateway")
logging.basicConfig(level=logging.INFO)

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# --- DOCUMENTATION: JSON SCHEMA ---
"""
INPUT (FROM ACR APP):
The app sends a 'multipart/form-data' POST. Logically, it maps to:
{
    "secret": "string",
    "source": "Incoming/Outgoing",
    "number": "+123456789",
    "date": 1712345678,
    "duration": 120,
    "note": "Initial user note",
    "file": [BINARY_AUDIO_DATA]
}

OUTPUT (GENERATED BY THIS SCRIPT):
Saved as {date}_{number}.json:
{
    "metadata": { "number": "+123456789", "date": 1712345678, ... },
    "transcript": [
        { "speaker": "SPEAKER_00", "start": 0.5, "end": 4.2, "text": "Hello, how can I help you?" },
        { "speaker": "SPEAKER_01", "start": 4.5, "end": 6.0, "text": "I have a question about my bill." }
    ]
}
"""

async def sync_transcript_to_app(number: str, transcript_text: str):
    """
    EXPERIMENTAL: Syncing back to the app notes field.
    Most Webhooks are 1-way. To update the app's notes, we would typically 
    need to target a secondary API if ACR provides one for remote updates.
    """
    logging.info(f"Attempting to sync transcript back to device for {number}...")
    # This is a placeholder for the logic required if the developer 
    # provides a PUT/PATCH endpoint for the app's local database.
    pass

def process_audio(file_path: str, call_id: str, metadata: dict):
    try:
        logging.info(f"Starting AI Pipeline for {call_id}...")

        # STEP 1: DIARIZATION
        diarize_pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1", 
            use_auth_token=HF_TOKEN
        ).to(torch.device(DEVICE))
        
        diarization = diarize_pipeline(file_path)
        del diarize_pipeline
        if DEVICE == "cuda": torch.cuda.empty_cache()

        # STEP 2: TRANSCRIPTION
        whisper_model = WhisperModel("tiny.en", device=DEVICE, compute_type="int8_float16")
        segments, _ = whisper_model.transcribe(file_path, beam_size=5, word_timestamps=True)
        
        segments = list(segments)
        full_text_list = []

        # STEP 3: ALIGNMENT
        final_transcript = []
        for segment in segments:
            midpoint = (segment.start + segment.end) / 2
            speaker = "Unknown"
            for turn, _, lab in diarization.itertracks(yield_label=True):
                if turn.start <= midpoint <= turn.end:
                    speaker = lab
                    break
            
            entry = {
                "speaker": speaker,
                "start": round(segment.start, 2),
                "end": round(segment.end, 2),
                "text": segment.text.strip()
            }
            final_transcript.append(entry)
            full_text_list.append(f"{speaker}: {segment.text.strip()}")

        # STEP 4: SAVE & SYNC
        output_data = {"metadata": metadata, "transcript": final_transcript}
        output_file = os.path.join(TRANSCRIPT_DIR, f"{call_id}.json")
        
        with open(output_file, "w") as f:
            json.dump(output_data, f, indent=4)
            
        # Format a plain text version for the 'Notes' field
        formatted_notes = "\n".join(full_text_list)
        # In a collaborative setup, we would trigger the sync-back here
        # await sync_transcript_to_app(metadata['number'], formatted_notes)

        logging.info(f"Success. Transcript for {call_id} is ready.")

    except Exception as e:
        logging.error(f"Pipeline Failure for {call_id}: {str(e)}")
    finally:
        if DEVICE == "cuda": torch.cuda.empty_cache()

@app.post("/api/Recording/upload")
async def handle_acr_upload(
    background_tasks: BackgroundTasks,
    secret: str = Form(...),
    source: str = Form(None),
    number: str = Form(None),
    date: int = Form(None),
    duration: int = Form(None),
    note: str = Form(None),
    file: UploadFile = File(...)
):
    if secret != ACR_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized Handshake")

    call_id = f"{date}_{number}" if date and number else str(uuid.uuid4())
    ext = file.filename.split(".")[-1]
    file_path = os.path.join(UPLOAD_DIR, f"{call_id}.{ext}")

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    metadata = {
        "source": source,
        "number": number,
        "date": date,
        "duration": duration,
        "note": note,
        "received_at": time.time()
    }

    background_tasks.add_task(process_audio, file_path, call_id, metadata)

    # Return a 200 OK to the phone app immediately so it can release the connection
    return {"status": "success", "message": "Audio received for processing"}

if __name__ == "__main__":
    import uvicorn
    # Bind to all interfaces for Tailscale visibility
    uvicorn.run(app, host="0.0.0.0", port=8000)
    ```
