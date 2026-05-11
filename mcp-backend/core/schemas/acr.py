from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class ACRWebhookPayload(BaseModel):
    """
    Schema for the ACR Phone Webhook inbound payload.
    Supports both standard phone call fields and Horizon extensions.
    """
    contact_name: str = Field("Unknown", alias="contact")
    phone_number: str = Field("", alias="phone")
    duration: Optional[str] = None
    duration_ms: Optional[int] = None
    timestamp: Optional[str] = None
    direction: Optional[str] = None  # "incoming" or "outgoing"
    note: Optional[str] = None       # transcript or manual note
    location: Optional[str] = None   # "lat;lon"
    address: Optional[str] = None
    external_id: Optional[str] = None
    
    class Config:
        populate_by_name = True

class CallRecordBase(BaseModel):
    contact_name: str
    phone_number: str
    duration: str
    timestamp: datetime
    status: str = "completed"
    direction: Optional[str] = None
    channel: str = "phone"

class CallRecordCreate(CallRecordBase):
    transcript_encrypted: Optional[str] = None
    transcript_iv: Optional[str] = None
    executive_brief: Optional[dict] = None
    sentiment: Optional[str] = "Neutral"
    tags: List[str] = []
    contact_id: Optional[str] = None # UUID linking to contacts table
    embedding: Optional[List[float]] = None
    
    # ACR Parse Metadata
    acr_pattern: Optional[str] = None
    acr_channel: Optional[str] = None
    acr_direction: Optional[str] = None
    acr_phone_e164: Optional[str] = None
