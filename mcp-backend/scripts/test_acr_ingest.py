import os
import requests
from dotenv import load_dotenv

# Load environment logic
load_dotenv()

API_URL = "http://localhost:8000/api/v1/calls/"
SECRET = os.getenv("ACR_WEBHOOK_SECRET")
AUDIO_FILE = "tests/test_audio.m4a"

def test_full_ingestion():
    print(f"🚀 Starting Ingestion Test...")
    print(f"URL: {API_URL}")
    print(f"Secret: {'SET' if SECRET else 'NOT SET'}")

    if not os.path.exists(AUDIO_FILE):
        print(f"❌ Error: {AUDIO_FILE} not found. Run ffmpeg command first.")
        return

    headers = {
        "X-ACR-Secret": SECRET
    }

    data = {
        "contact_name": "Antigravity Test",
        "phone_number": "+15550199",
        "duration": "1",
        "timestamp": "2026-04-07T21:00:00Z"
    }

    files = {
        "file": ("test_audio.m4a", open(AUDIO_FILE, "rb"), "audio/mp4")
    }

    try:
        print(f"📡 Sending multipart request...")
        response = requests.post(API_URL, headers=headers, data=data, files=files)
        
        print(f"📥 Status Code: {response.status_code}")
        if response.status_code == 200:
            print("✅ Success!")
            print(f"Response: {response.json()}")
        else:
            print(f"❌ Failed: {response.text}")
            
    except Exception as e:
        print(f"💥 Connection Error: {e}")

if __name__ == "__main__":
    test_full_ingestion()
