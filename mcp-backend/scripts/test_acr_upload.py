"""
ACR Phone Webhook Integration Test
===================================
Tests the actual endpoint that ACR Phone hits: POST :9000/v1/audio/transcriptions

This script replicates the exact multipart/form-data request that ACR Phone
(NLLAPPS) sends after a call ends, using the same field names the app sends:
  Secret    → secondary auth (ACR_WEBHOOK_SECRET from .env)
  Source    → call direction ("Outgoing" | "Incoming")
  Number    → caller phone number
  Date      → Unix timestamp of the call
  Duration  → call length in seconds
  file      → audio blob

Usage:
  python scripts/test_acr_upload.py [path/to/audio.m4a]

The server must be running on port 9000:
  uvicorn ingestion_server:app --host 0.0.0.0 --port 9000 --reload
"""
import os
import sys
import json
import time
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

# ── Config — reads from .env ─────────────────────────────────────────────────
BASE_URL     = os.getenv("TEST_INGEST_URL", "http://localhost:9000")
ENDPOINT     = f"{BASE_URL}/v1/audio/transcriptions"
API_KEY      = os.getenv("HORIZON_API_KEY", "")
ACR_SECRET   = os.getenv("ACR_WEBHOOK_SECRET", "")

SAMPLE_AUDIO = Path(sys.argv[1]) if len(sys.argv) > 1 else None


def _headers() -> dict:
    """Primary auth: Bearer token in Authorization header."""
    if not API_KEY:
        print("⚠️  HORIZON_API_KEY not set in .env — requests will be rejected with 401/503")
    return {"Authorization": f"Bearer {API_KEY}"}


def _dummy_audio() -> bytes:
    """Minimal valid WAV file (44-byte header, 1s silence at 16kHz mono)."""
    import struct
    sample_rate, num_samples, num_channels, bit_depth = 16000, 16000, 1, 16
    byte_rate = sample_rate * num_channels * bit_depth // 8
    block_align = num_channels * bit_depth // 8
    data_size = num_samples * block_align
    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF", 36 + data_size, b"WAVE",
        b"fmt ", 16, 1, num_channels, sample_rate,
        byte_rate, block_align, bit_depth,
        b"data", data_size,
    )
    return header + b"\x00" * data_size


def test_health():
    print("\n── Health check ─────────────────────────────────────────")
    try:
        r = requests.get(f"{BASE_URL}/v1/health", timeout=5)
        print(f"Status: {r.status_code}")
        print(json.dumps(r.json(), indent=2))
        return r.status_code == 200
    except requests.ConnectionError:
        print(f"❌ Cannot reach {BASE_URL} — is the ingestion server running?")
        print("   Run: uvicorn ingestion_server:app --host 0.0.0.0 --port 9000 --reload")
        return False


def test_outgoing_call(audio_path: Path = None):
    """Simulate ACR Phone posting an outgoing call — uses exact ACR field names."""
    print("\n── Outgoing call (ACR Phone exact field names) ──────────")

    if audio_path and audio_path.exists():
        audio_bytes = audio_path.read_bytes()
        filename = audio_path.name
        content_type = "audio/mp4"
    else:
        print("⚠️  No audio file provided — using synthetic WAV (transcription will be empty)")
        audio_bytes = _dummy_audio()
        filename = "2026-05-27_120000_OUT_+15550100_Test-Contact.wav"
        content_type = "audio/wav"

    # Exact multipart fields ACR Phone sends
    data = {
        "model":        "whisper-1",
        "Secret":       ACR_SECRET,          # ACR_WEBHOOK_SECRET from .env
        "Source":       "Outgoing",          # ACR direction field → normalized to "outgoing"
        "Number":       "+15550100",         # Caller phone
        "Date":         str(int(time.time())),  # Unix timestamp
        "Duration":     "125",               # Call duration in seconds
        "contact_name": "Test Contact",      # Horizon extension
        "language":     "en",
        "response_format": "verbose_json",
    }
    files = {"file": (filename, audio_bytes, content_type)}

    print(f"POST {ENDPOINT}")
    print(f"  Secret: {'SET (' + ACR_SECRET[:4] + '...)' if ACR_SECRET else 'NOT SET'}")
    print(f"  Source: {data['Source']}")
    print(f"  Number: {data['Number']}")
    print(f"  File:   {filename} ({len(audio_bytes):,} bytes)")

    try:
        r = requests.post(ENDPOINT, headers=_headers(), data=data, files=files, timeout=120)
        print(f"\nStatus: {r.status_code}")
        if r.status_code == 200:
            body = r.json()
            print("✅ Success!")
            print(f"  record_id:  {body.get('horizon_meta', {}).get('record_id', 'N/A')}")
            print(f"  direction:  {body.get('horizon_meta', {}).get('direction', 'N/A')}")
            print(f"  processing: {body.get('horizon_meta', {}).get('processing_time_s', 'N/A')}s")
            print(f"  brief:      {'✓' if body.get('horizon_meta', {}).get('brief_generated') else '✗ (transcript may be too short)'}")
            print(f"\nACR note preview (first 300 chars):\n{body.get('text', '')[:300]}")
        else:
            print(f"❌ Failed: {r.text[:500]}")
    except requests.Timeout:
        print("❌ Timeout — transcription taking longer than 120s (try a shorter clip)")
    except requests.ConnectionError:
        print(f"❌ Connection refused — is the server at {BASE_URL} running?")


def test_incoming_call(audio_path: Path = None):
    """Simulate an incoming call."""
    print("\n── Incoming call ────────────────────────────────────────")
    audio_bytes = audio_path.read_bytes() if (audio_path and audio_path.exists()) else _dummy_audio()
    filename = audio_path.name if audio_path else "2026-05-27_130000_IN_+15550199_Unknown.wav"

    data = {
        "model":    "whisper-horizon",
        "Secret":   ACR_SECRET,
        "Source":   "Incoming",
        "Number":   "+15550199",
        "Date":     str(int(time.time())),
        "Duration": "47",
        "language": "en",
        "response_format": "json",  # Minimal response — just the text field
    }
    files = {"file": (filename, audio_bytes, "audio/wav")}

    r = requests.post(ENDPOINT, headers=_headers(), data=data, files=files, timeout=120)
    print(f"Status: {r.status_code}")
    if r.status_code == 200:
        body = r.json()
        print(f"✅ Success! Note preview: {body.get('text', '')[:200]}")
    else:
        print(f"❌ {r.text[:300]}")


def test_bad_secret():
    """Confirm that a wrong secret is rejected when ACR_WEBHOOK_SECRET is configured."""
    print("\n── Bad secret rejection ─────────────────────────────────")
    if not ACR_SECRET:
        print("⚠️  ACR_WEBHOOK_SECRET not set — skipping (secondary auth is inactive)")
        return

    audio_bytes = _dummy_audio()
    data = {
        "model":    "whisper-1",
        "Secret":   "definitely_wrong_secret",
        "Source":   "Outgoing",
        "Number":   "+15550000",
        "Date":     str(int(time.time())),
        "Duration": "10",
    }
    files = {"file": ("test.wav", audio_bytes, "audio/wav")}
    r = requests.post(ENDPOINT, headers=_headers(), data=data, files=files, timeout=10)
    if r.status_code == 401:
        print("✅ Correctly rejected with 401")
    else:
        print(f"⚠️  Expected 401, got {r.status_code}: {r.text[:200]}")


def test_bad_bearer():
    """Confirm that a wrong Bearer token is rejected."""
    print("\n── Bad Bearer token rejection ───────────────────────────")
    audio_bytes = _dummy_audio()
    data = {"model": "whisper-1", "Source": "Outgoing", "Number": "+15550000",
            "Date": str(int(time.time())), "Duration": "5"}
    files = {"file": ("test.wav", audio_bytes, "audio/wav")}
    r = requests.post(ENDPOINT,
                      headers={"Authorization": "Bearer completely_wrong_key"},
                      data=data, files=files, timeout=10)
    if r.status_code == 401:
        print("✅ Correctly rejected with 401")
    else:
        print(f"⚠️  Expected 401, got {r.status_code}: {r.text[:200]}")


if __name__ == "__main__":
    print(f"Horizon ACR Webhook Test")
    print(f"  Target:     {ENDPOINT}")
    print(f"  API key:    {'SET (' + API_KEY[:8] + '...)' if API_KEY else 'NOT SET ⚠️'}")
    print(f"  ACR secret: {'SET' if ACR_SECRET else 'NOT SET (secondary auth inactive)'}")

    if not test_health():
        sys.exit(1)

    audio = SAMPLE_AUDIO
    test_outgoing_call(audio)
    test_incoming_call(audio)
    test_bad_secret()
    test_bad_bearer()

    print("\n── Done ─────────────────────────────────────────────────\n")
