"""
Horizon API Key Authentication
Replaces ACR Secret pattern with standard Bearer token auth.
Header: Authorization: Bearer hzn_<key>
"""
import os
import logging
from fastapi import Header, HTTPException, status

logger = logging.getLogger(__name__)


def verify_api_key(authorization: str = Header(None)) -> str:
    """
    Standard Bearer token authentication.
    Reads HORIZON_API_KEY from environment.
    Raises 401 if missing or invalid.
    """
    expected_key = os.environ.get("HORIZON_API_KEY", "")

    if not expected_key:
        logger.warning("[AUTH] HORIZON_API_KEY not set — all requests will be rejected.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Server mis-configured: no API key set.",
        )

    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header. Use: Authorization: Bearer <key>",
            headers={"WWW-Authenticate": "Bearer"},
        )

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or token.strip() != expected_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return token.strip()
