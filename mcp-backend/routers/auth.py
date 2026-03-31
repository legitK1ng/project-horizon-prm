from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import httpx
import os
import logging
from db.supabase_client import get_supabase
from core.utils import generate_stable_uuid

logger = logging.getLogger(__name__)
router = APIRouter()

class AuthCodeRequest(BaseModel):
    code: str
    user_id: str
    redirect_uri: str = "http://localhost:3000"

@router.post("/google/callback")
async def google_oauth_callback(req: AuthCodeRequest):
    """
    REQ-031: Exchange authorization code for tokens and store refresh token.
    """
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    
    if not client_id or not client_secret or client_secret == "YOUR_GOOGLE_CLIENT_SECRET_HERE":
        logger.error("[AUTH] Missing Google Client ID or Secret in environment.")
        raise HTTPException(status_code=500, detail="OAuth credentials not configured on server.")

    token_url = "https://oauth2.googleapis.com/token"
    data = {
        "code": req.code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": req.redirect_uri,
        "grant_type": "authorization_code",
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(token_url, data=data)
        if response.status_code != 200:
            logger.error(f"[AUTH] Token exchange failed: {response.text}")
            raise HTTPException(status_code=response.status_code, detail=f"Failed to exchange code: {response.text}")
        
        tokens = response.json()
        access_token = tokens.get("access_token")
        refresh_token = tokens.get("refresh_token")
        
        # Store refresh token in profiles table for persistence
        if refresh_token:
            supabase = get_supabase()
            try:
                # REQ-031: Ensure we use a stable UUID even if frontend sends a string
                stable_user_id = req.user_id
                try:
                    import uuid
                    uuid.UUID(stable_user_id)
                except (ValueError, AttributeError):
                    stable_user_id = generate_stable_uuid(req.user_id)
                    logger.info(f"[AUTH] Mapped string user_id {req.user_id} to stable UUID {stable_user_id}")

                # REQ-031: Upsert the refresh token into the user's profile
                supabase.table("profiles").upsert({
                    "id": stable_user_id,
                    "google_refresh_token": refresh_token
                }).execute()
                logger.info(f"[AUTH] Stored refresh token for user {stable_user_id}")
            except Exception as e:
                logger.error(f"[AUTH] Failed to store refresh token: {str(e)}")
        
        return {
            "status": "success",
            "access_token": access_token,
            "refresh_token": refresh_token,
            "expires_in": tokens.get("expires_in")
        }
