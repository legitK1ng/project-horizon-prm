import os
from fastapi import Header, HTTPException, status

def verify_acr_secret(
    x_horizon_key: str = Header(None),
    x_acr_secret:  str = Header(None),
):
    """
    REQ-018: Secret Handshake validation.
    Accepts x-horizon-key (primary) or legacy x-acr-secret header.
    """
    horizon_key = os.environ.get("HORIZON_API_KEY")
    legacy_key  = os.environ.get("ACR_WEBHOOK_SECRET")

    provided = x_horizon_key or x_acr_secret

    if not horizon_key and not legacy_key:
        print("[AUTH] WARNING: No API key set in environment — allowing request.")
        return True

    valid_keys = set(filter(None, [horizon_key, legacy_key]))
    if provided not in valid_keys:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key (use x-horizon-key header)",
            headers={"WWW-Authenticate": "Header"},
        )
    return True
