"""
HORIZON PRM — FastAPI Backend v2 (Unified Entry Point)
AGENT-3a Output | REQs: REQ-014, REQ-016, REQ-017, REQ-022, REQ-027

This is the refactored main.py with:
- /api/v1/ versioned routing
- Service-based decomposition (imported from services/)
- Secrets from environment variables only
- Gemini exclusively server-side
- Windows patches for pyannote.audio
"""
import os
import sys
import logging
from contextlib import asynccontextmanager
from dotenv import load_dotenv

# Initialize environment variables at the very beginning (REQ-014)
load_dotenv()

# Applied first to handle Windows audio decoder if architecture is win32
from core.windows_patches import apply_windows_patches
apply_windows_patches()
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.FileHandler("server_log.txt", mode='a', encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import calls, contacts, enrichments, digest, sync, nudges, data, auth, system, health_router as health
from db.supabase_client import init_supabase
from core.whisper_engine import init_whisper
from core.diarization_engine import init_diarization


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: initialize all services. Shutdown: clean up."""
    print("[HORIZON] Starting up...", flush=True)

    # Initialize database
    app.state.supabase = init_supabase()

    # Initialize AI engines (GPU if available)
    app.state.whisper = init_whisper()
    app.state.diarization = init_diarization()

    print("[HORIZON] All services initialized. Ready.", flush=True)
    yield

    print("[HORIZON] Shutting down.", flush=True)


app = FastAPI(
    title="Horizon PRM API",
    version="1.0.0",
    description="Relationship Intelligence Platform — MCP Backend",
    lifespan=lifespan,
    redirect_slashes=False
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("ALLOWED_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── API v1 Router Registration ───────────────────────────────────
app.include_router(health.router, prefix="/api/v1/health", tags=["health"])
app.include_router(sync.router, prefix="/api/v1/sync", tags=["sync"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(system.router, prefix="/api/v1/system", tags=["system"])
app.include_router(data.router,        prefix="/api/v1/data", tags=["data"])
app.include_router(contacts.router,    prefix="/api/v1/contacts", tags=["crm"])
app.include_router(calls.router,       prefix="/api/v1/calls")
app.include_router(enrichments.router, prefix="/api/v1/enrichments")
app.include_router(digest.router,      prefix="/api/v1/digest")
app.include_router(sync.router,        prefix="/api/v1/sync")
app.include_router(nudges.router,      prefix="/api/v1/nudges", tags=["proactive"])


# Compatible route for legacy ingestion if needed
@app.post("/calls", tags=["Legacy"])
async def legacy_calls_proxy(req: dict = None):
    # This acts as a proxy to /api/v1/calls if old clients still call /calls
    # For now, we prefer clients update to the versioned API.
    return {"message": "Please use /api/v1/calls for production ingestion."}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    # 'main:app' refers to this file
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
