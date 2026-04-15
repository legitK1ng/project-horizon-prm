"""
HORIZON PRM - FastAPI Backend v2 (Unified Entry Point)
AGENT-3a Output | REQs: REQ-014, REQ-016, REQ-017, REQ-022, REQ-027
"""
import os
import sys
import logging
from contextlib import asynccontextmanager
from dotenv import load_dotenv

# Initialize environment variables
try:
    load_dotenv()
except Exception as e:
    print(f"[DEBUG] Dotenv failed (likely null byte in env): {e}")

# Logging initialized early
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from routers import calls, health, auth, system, contacts, sync, data, nudges, enrichments, ai, transcriptions

from db.supabase_client import init_supabase

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: initialize database."""
    logger.info("[HORIZON] Starting up...")
    app.state.supabase = init_supabase()
    logger.info("[HORIZON] API listener active. Ready.")
    yield
    logger.info("[HORIZON] Shutting down.")

app = FastAPI(
    title="Horizon PRM API",
    version="1.0.0",
    description="Relationship Intelligence Platform - MCP Backend",
    lifespan=lifespan,
    redirect_slashes=False
)

CORS_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:8000",
    "http://localhost",
    "capacitor://localhost",      # Capacitor mobile wrapper
    "https://localhost",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=r"https?://localhost(:\d+)?",  # catch any localhost port in dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API v1 Router Registration
app.include_router(health.router, prefix="/api/v1/health", tags=["health"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(system.router, prefix="/api/v1/system", tags=["system"])
app.include_router(calls.router, prefix="/api/v1/calls", tags=["ingestion"])
app.include_router(contacts.router, prefix="/api/v1/contacts", tags=["contacts"])
app.include_router(sync.router, prefix="/api/v1/sync", tags=["sync"])
app.include_router(data.router, prefix="/api/v1/data", tags=["data"])
app.include_router(nudges.router, prefix="/api/v1/nudges", tags=["nudges"])
app.include_router(enrichments.router, prefix="/api/v1/enrichments", tags=["enrichment"])
app.include_router(ai.router, prefix="/api/v1/ai", tags=["ai"])

# ACR Phone / Whisper-compatible transcription webhook (OpenAI API surface)
app.include_router(transcriptions.router, prefix="/v1/audio", tags=["transcription"])

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
