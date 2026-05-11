import requests
import json
import os
import time
from pathlib import Path

# Configuration
API_URL = "http://localhost:8000/api/v1/calls"
API_KEY = "magicalbluetuba" # Default dev key from .env.example
SAMPLE_AUDIO_PATH = "C:/Users/owner/OneDrive/Desktop/horizon/ACR Phone_files/sample_call.m4a" # Adjust if needed

def test_upload_text_only():
    print("\n--- Testing Text-Only Ingestion ---")
    payload = {
        "contact_name": "John Doe",
        "phone_number": "+1234567890",
        "duration": "05:22",
        "note": "This is a test transcript for a call with John Doe. We discussed the Horizon PRM roadmap and the upcoming OSINT pipeline integration.",
        "timestamp": "2026-05-01T12:00:00Z"
    }
    headers = {
        "x-horizon-key": API_KEY
    }
    
    response = requests.post(API_URL, data=payload, headers=headers)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")

def test_upload_with_audio():
    print("\n--- Testing Audio Ingestion ---")
    
    # Create a dummy audio file if sample doesn't exist
    audio_path = Path(SAMPLE_AUDIO_PATH)
    if not audio_path.exists():
        print(f"Sample audio not found at {SAMPLE_AUDIO_PATH}. Creating a dummy file.")
        audio_path.parent.mkdir(parents=True, exist_ok=True)
        with open(audio_path, "wb") as f:
            f.write(b"dummy audio content")

    payload = {
        "contact_name": "Jane Smith",
        "phone_number": "+1987654321",
        "duration": "02:15",
        "timestamp": "2026-05-01T13:00:00Z"
    }
    headers = {
        "x-horizon-key": API_KEY
    }
    
    with open(audio_path, "rb") as f:
        files = {"file": (audio_path.name, f, "audio/mp4")}
        response = requests.post(API_URL, data=payload, files=files, headers=headers)
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")

def test_handshake_failure():
    print("\n--- Testing Handshake Failure ---")
    payload = {"contact_name": "Hacker"}
    headers = {"x-horizon-key": "wrong_secret"}
    
    response = requests.post(API_URL, data=payload, headers=headers)
    print(f"Status Code: {response.status_code} (Expected 401)")
    print(f"Response: {response.text}")

if __name__ == "__main__":
    # Ensure server is running or prompt user
    print("Ensure the FastAPI server is running on http://localhost:8000")
    try:
        test_upload_text_only()
        test_upload_with_audio()
        test_handshake_failure()
    except requests.exceptions.ConnectionError:
        print("ERROR: Could not connect to server. Is it running?")
