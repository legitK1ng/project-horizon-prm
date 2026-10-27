"""
Horizon API Key Authentication
Standard Bearer token authentication with fallback for ACR Phone 'Secret' form field.
Header: Authorization: Bearer hzn_<key>
"""
import os
import logging
from typing import Optional
from fastapi import Header, HTTPException, status, Form

logger = logging.getLogger(__name__)


def verify_api_key(
    authorization: str = Header(None),
    Secret: Optional[str] = Form(None),  # ACR Phone sends this as form field 'Secret'
) -> str:
    """
    Standard Bearer token authentication with fallback for ACR Phone 'Secret' form field.
    Reads HORIZON_API_KEY (and optional ACR_WEBHOOK_SECRET) from environment.
    Raises 401 if missing or invalid.
    """
    expected_key = os.environ.get("HORIZON_API_KEY", "")
    acr_secret = os.environ.get("ACR_WEBHOOK_SECRET", "")

    if not expected_key and not acr_secret:
        logger.warning("[AUTH] Neither HORIZON_API_KEY nor ACR_WEBHOOK_SECRET set — all requests will be rejected.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Server mis-configured: no API key set.",
        )

    # 1. Try Authorization: Bearer <token> header
    token = None
    if authorization:
        scheme, _, raw_token = authorization.partition(" ")
        if scheme.lower() == "bearer" and raw_token.strip():
            token = raw_token.strip()

    # 2. Try Secret multipart form field as fallback (ACR Phone native webhook auth)
    if not token and Secret:
        token = Secret.strip()

    valid_tokens = {k for k in (expected_key, acr_secret) if k}
    if not token or token not in valid_tokens:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key or Secret.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return token
