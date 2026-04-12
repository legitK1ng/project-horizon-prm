"""
Horizon Ingestion Server — Port 9000
Separate from the dashboard API (port 8000).

Whisper v1-compatible surface:
  POST /v1/audio/transcriptions   ← Main ingestion endpoint
  GET  /v1/inspector              ← Live SSE request/response inspector
  GET  /v1/health                 ← Health check

Authentication: Authorization: Bearer <HORIZON_API_KEY>
Network:        Expose via `tailscale funnel 9000`
"""
import os
import sys
import logging
from contextlib import asynccontextmanager

# ── Must come before heavy imports ─────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

# Load env — guard against null-byte corrupted files
try:
    from dotenv import load_dotenv

    _env_path = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(_env_path):
        raw = open(_env_path, "rb").read()
        if b"\x00" in raw:
            logger.warning("[ENV] Null bytes detected in .env — stripping before load.")
            clean = raw.replace(b"\x00", b"")
            open(_env_path, "wb").write(clean)
        load_dotenv(_env_path)
except Exception as e:
    logger.warning(f"[ENV] dotenv load failed: {e} — using OS environment only.")

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.responses import StreamingResponse

from middleware.inspector import InspectorMiddleware, inspector_sse_stream
from routers import transcriptions
from db.supabase_client import init_supabase


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("[HORIZON-INGEST] Starting ingestion server on port 9000...")
    
    # Non-blocking DB init: If Supabase is down/hanging, don't freeze the server
    try:
        app.state.supabase = init_supabase()
    except Exception as e:
        logger.error(f"[DB] Supabase init failed/timed out: {e}. Running in LOCAL-ONLY mode.")
        app.state.supabase = None

    api_key = os.environ.get("HORIZON_API_KEY", "")
    if api_key:
        logger.info(f"[AUTH] API key loaded. Prefix: {api_key[:8]}...")
    else:
        logger.warning("[AUTH] HORIZON_API_KEY is NOT set — all requests will be rejected!")
    
    logger.info("[HORIZON-INGEST] Ready. Whisper v1 endpoint active.")
    yield
    logger.info("[HORIZON-INGEST] Shutting down.")


# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Horizon Ingestion API",
    version="1.0.0",
    description=(
        "OpenAI Whisper v1-compatible audio transcription endpoint. "
        "Separate from the dashboard API. Expose via Tailscale Funnel."
    ),
    lifespan=lifespan,
    docs_url="/v1/docs",
    redoc_url=None,
)

# ── Middleware ─────────────────────────────────────────────────────────────────
# Inspector MUST be added before CORS so it captures raw requests
app.add_middleware(InspectorMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Routes ─────────────────────────────────────────────────────────────────────
app.include_router(transcriptions.router, prefix="/v1/audio")


@app.get("/v1/health", tags=["meta"])
async def health():
    """Liveness check — also shows which API key prefix is loaded."""
    key = os.environ.get("HORIZON_API_KEY", "")
    return {
        "status": "ok",
        "service": "horizon-ingestion",
        "api_key_set": bool(key),
        "api_key_prefix": key[:8] + "..." if key else None,
    }


@app.get("/v1/inspector", tags=["meta"])
async def inspector_stream(request: Request):
    """
    Server-Sent Events stream — see every request/response in real time.
    Open in a terminal with:
        curl -N -H "Authorization: Bearer <key>" http://localhost:9000/v1/inspector
    Or in your browser (no auth needed for the inspector itself).
    """
    return StreamingResponse(
        inspector_sse_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Nginx: disable buffering
        },
    )


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("INGEST_PORT", 9000))
    uvicorn.run(
        "ingestion_server:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        reload_dirs=["."],
        log_level="info",
    )
