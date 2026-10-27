import os
import requests
import time

# --- TEST SETTINGS ---
# Use localhost if running locally, or replace with Tailscale IP 
GATEWAY_URL = "http://localhost:8000/api/Recording/upload"
SECRET = os.environ.get("HORIZON_API_KEY", "dummy_test_secret") # Must match your server's configured API_KEY / ACR_SECRET
TEST_AUDIO_FILE = "dummy_test_audio.wav"

def generate_dummy_audio(filename):
    """Creates a 1-second blank WAV file to bypass audio parsing checks."""
    import wave
    with wave.open(filename, 'w') as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(44100)
        f.writeframes(b'\x00' * 44100) # 1 second of silence

if not os.path.exists(TEST_AUDIO_FILE):
    generate_dummy_audio(TEST_AUDIO_FILE)

# --- PAYLOAD DATA ---
# Mirrors the UploadRecordViewModel C# object
data = {
    "Secret": SECRET,
    "Source": "Incoming",
    "Number": "+15551234567",
    "Date": str(int(time.time())),
    "Duration": "60",
    "Note": "This is a simulated ACR Phone Request"
}

# --- SEND SIMULATED REQUEST ---
print(f"Sending Mock ACR Webhook to: {GATEWAY_URL}")
print(f"Payload: {data}")

with open(TEST_AUDIO_FILE, 'rb') as audio_data:
    # Key name 'File' matches ACR signature exactly
    files = {'File': ('dummy_test_audio.wav', audio_data, 'audio/wav')}
    try:
        response = requests.post(GATEWAY_URL, data=data, files=files, headers={'User-Agent': 'ACR Phone Webhook Tester'})
        print(f"\nResponse Code: {response.status_code}")
        print(f"Response Body: {response.json()}")
        
        if response.status_code == 200:
            print("\n[SUCCESS] Handshake Successful! Check the uvicorn output (main.py) to watch the background background_tasks transcription process.")
        elif response.status_code == 401:
            print("\n[ERROR] Handshake Failed: 401 Unauthorized. Double-check the SECRET variable.")
        else:
            print("\n[WARNING] Failed. See response details above.")
            
    except requests.exceptions.ConnectionError:
        print(f"\n[ERROR] Connection Refused. Is the FastAPI server running on {GATEWAY_URL}?")

