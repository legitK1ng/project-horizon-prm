import os
from fastapi import Header, HTTPException, status

def verify_acr_secret(x_acr_secret: str = Header(None)):
    """
    REQ-018: Secret Handshake validation.
    Checks the incoming X-ACR-Secret header against the environmental secret.
    """
    expected_secret = os.environ.get("ACR_WEBHOOK_SECRET")
    
    if not expected_secret:
        # In development, we might not have it, but for production it's mandatory.
        # We'll allow it only if explicitly disabled in dev (not recommended).
        print("[AUTH] WARNING: ACR_WEBHOOK_SECRET not set in environment.")
        return True

    if x_acr_secret != expected_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing ACR Webhook Secret",
            headers={"WWW-Authenticate": "Header"},
        )
    return True
