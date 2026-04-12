import os
import pytest
from fastapi.testclient import TestClient
from main import app
from unittest.mock import MagicMock, patch

client = TestClient(app)

@pytest.fixture
def mock_supabase():
    with patch("main.init_supabase") as mock:
        mock_client = MagicMock()
        mock.return_value = mock_client
        app.state.supabase = mock_client
        yield mock_client

@pytest.fixture
def webhook_secret():
    secret = "test-secret-123"
    os.environ["ACR_WEBHOOK_SECRET"] = secret
    yield secret

def test_ingest_call_no_auth(mock_supabase):
    """Verify that 401 is returned if X-ACR-Secret is missing."""
    response = client.post("/api/v1/calls/", data={"contact_name": "Test User"})
    assert response.status_code == 401
    assert "Invalid or missing ACR Webhook Secret" in response.json()["detail"]

def test_ingest_call_invalid_auth(mock_supabase, webhook_secret):
    """Verify that 401 is returned if X-ACR-Secret is wrong."""
    response = client.post(
        "/api/v1/calls/",
        headers={"X-ACR-Secret": "wrong-secret"},
        data={"contact_name": "Test User"}
    )
    assert response.status_code == 401

def test_ingest_call_success_form_data(mock_supabase, webhook_secret):
    """Verify successful ingestion with form data and authorized secret."""
    # Mock Supabase insert
    mock_supabase.table.return_value.insert.return_value.execute.return_value = MagicMock(data=[{"id": "test-uuid"}])
    
    response = client.post(
        "/api/v1/calls/",
        headers={"X-ACR-Secret": webhook_secret},
        data={
            "contact_name": "John Doe",
            "phone_number": "1234567890",
            "note": "This is a test transcript."
        }
    )
    
    assert response.status_code == 200
    assert response.json()["status"] == "success"
    assert response.json()["call_id"] == "test-uuid"

@patch("routers.calls.process_audio_ingest")
def test_ingest_call_with_audio(mock_process, mock_supabase, webhook_secret):
    """Verify successful ingestion with an audio file."""
    mock_process.return_value = "audio_ingest/temp/test.wav"
    mock_supabase.table.return_value.insert.return_value.execute.return_value = MagicMock(data=[{"id": "audio-uuid"}])
    
    # Create a dummy audio file
    dummy_content = b"fake-audio-content"
    
    response = client.post(
        "/api/v1/calls/",
        headers={"X-ACR-Secret": webhook_secret},
        files={"file": ("test.m4a", dummy_content, "audio/mp4")},
        data={"contact_name": "Audio User"}
    )
    
    assert response.status_code == 200
    assert response.json()["status"] == "success"
    assert "Call ingested and processed" in response.json()["message"]
    mock_process.assert_called_once()
