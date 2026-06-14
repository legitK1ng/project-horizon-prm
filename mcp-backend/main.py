"""
HORIZON PRM - FastAPI Backend v3
Items: 4 (error handling), 21 (structured logging), 23 (rate limiting),
       5 (Ollama), 11 (Actions), 18 (SSE events)
"""
import os
import sys
import time
import json
import logging
from contextlib import asynccontextmanager
from dotenv import load_dotenv

try:
    load_dotenv()
except Exception as e:
    print(f"[DEBUG] Dotenv failed: {e}")

# ── Structured Logging — Item 21 ─────────────────────────────────────────────

class StructuredFormatter(logging.Formatter):
    """Emit every log record as a JSON line for easy ingestion."""
    def format(self, record: logging.LogRecord) -> str:
        return json.dumps({
            "level":   record.levelname,
            "name":    record.name,
            "msg":     record.getMessage(),
            "ts":      self.formatTime(record, self.datefmt),
        })

handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(StructuredFormatter())
logging.basicConfig(level=logging.INFO, handlers=[handler])
logger = logging.getLogger(__name__)

# ── FastAPI Imports ───────────────────────────────────────────────────────────

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from routers import (
    calls, health, auth, system, contacts,
    sync, data, nudges, enrichments, ai,
)
from routers import ollama        as ollama_router
from routers import actions       as actions_router
from routers import events        as events_router
from routers import batch_ingest  as batch_ingest_router
from routers import digest        as digest_router

from db.supabase_client import init_supabase


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("[HORIZON] Starting up…")
    app.state.supabase = init_supabase()

    # Verify Ollama daemon is reachable (non-fatal — model is cloud-hosted)
    try:
        from services.ollama_service import health_check as ollama_health, DEFAULT_MODEL
        result = await ollama_health()
        if result["status"] == "ok":
            logger.info(f"[HORIZON] Ollama daemon online — model: {DEFAULT_MODEL}")
        else:
            logger.warning(f"[HORIZON] Ollama daemon not reachable: {result.get('error')} — run `ollama serve`")
    except Exception as e:
        logger.warning(f"[HORIZON] Ollama check skipped: {e}")

    logger.info("[HORIZON] API listener active. Ready.")
    yield
    logger.info("[HORIZON] Shutting down.")


# ── App Factory ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="Horizon PRM API",
    version="2.0.0",
    description="Relationship Intelligence Platform — MCP Backend",
    lifespan=lifespan,
    redirect_slashes=False,
)


# ── CORS ──────────────────────────────────────────────────────────────────────

CORS_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:3000",
    "http://localhost:8000",
    "http://localhost",
    "capacitor://localhost",
    "https://localhost",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=r"https?://localhost(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request Timing Middleware — Item 21 ───────────────────────────────────────

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception as exc:
        elapsed = (time.perf_counter() - start) * 1000
        logger.error(json.dumps({
            "event":   "request_error",
            "method":  request.method,
            "path":    request.url.path,
            "ms":      round(elapsed, 2),
            "error":   str(exc),
        }))
        raise
    elapsed = (time.perf_counter() - start) * 1000
    logger.info(json.dumps({
        "event":  "request",
        "method": request.method,
        "path":   request.url.path,
        "status": response.status_code,
        "ms":     round(elapsed, 2),
    }))
    return response


# ── Item 23: Simple in-process rate limiter ───────────────────────────────────
# For production, replace with slowapi + Redis. This covers single-worker dev.

import collections

_rate_store: dict[str, collections.deque] = {}
_RATE_LIMIT  = int(os.environ.get("RATE_LIMIT_RPM", 120))   # requests per minute per IP
_RATE_WINDOW = 60                                             # seconds

@app.middleware("http")
async def rate_limit(request: Request, call_next):
    if request.url.path.startswith("/api/v1/events"):
        # SSE streams must not be rate-limited
        return await call_next(request)

    ip  = request.client.host if request.client else "unknown"
    now = time.monotonic()
    dq  = _rate_store.setdefault(ip, collections.deque())

    # Purge timestamps older than the window
    while dq and now - dq[0] > _RATE_WINDOW:
        dq.popleft()

    if len(dq) >= _RATE_LIMIT:
        return JSONResponse(
            status_code=429,
            content={"error": "Rate limit exceeded", "retry_after": _RATE_WINDOW},
            headers={"Retry-After": str(_RATE_WINDOW)},
        )
    dq.append(now)
    return await call_next(request)


# ── Item 4: Global Exception Handler ─────────────────────────────────────────

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(json.dumps({
        "event":  "unhandled_exception",
        "path":   request.url.path,
        "method": request.method,
        "error":  str(exc),
        "type":   type(exc).__name__,
    }))
    return JSONResponse(
        status_code=500,
        content={
            "error":   "Internal Server Error",
            "details": str(exc),
            "path":    request.url.path,
        },
    )


# ── Router Registration ───────────────────────────────────────────────────────

# Existing routers
app.include_router(health.router,         prefix="/api/v1/health",         tags=["health"])
app.include_router(auth.router,           prefix="/api/v1/auth",           tags=["auth"])
app.include_router(system.router,         prefix="/api/v1/system",         tags=["system"])
app.include_router(calls.router,          prefix="/api/v1/calls",          tags=["ingestion"])
app.include_router(contacts.router,       prefix="/api/v1/contacts",       tags=["contacts"])
app.include_router(sync.router,           prefix="/api/v1/sync",           tags=["sync"])
app.include_router(data.router,           prefix="/api/v1/data",           tags=["data"])
app.include_router(nudges.router,         prefix="/api/v1/nudges",         tags=["nudges"])
app.include_router(enrichments.router,    prefix="/api/v1/enrichments",    tags=["enrichment"])
app.include_router(ai.router,             prefix="/api/v1/ai",             tags=["ai"])

# New routers
app.include_router(ollama_router.router,  prefix="/api/v1/ollama",         tags=["ollama"])   # Item 5
app.include_router(actions_router.router, prefix="/api/v1/actions",        tags=["actions"])  # Item 11
app.include_router(events_router.router,  prefix="/api/v1/events",         tags=["events"])   # Item 18

# NOTE: ACR / Whisper transcription endpoint is registered ONLY on the ingestion
# server (ingestion_server.py, port 9000). It must NOT be registered here on
# port 8000 — doing so bypasses the InspectorMiddleware, the Sentinel, and
# Tailscale Funnel isolation. See CONSTITUTION Section 2 (Two-Server Architecture).

# ACR batch archive ingestion
app.include_router(batch_ingest_router.router,     prefix="/api/v1/batch-ingest",   tags=["batch-ingest"])

# Weekly AI digest — REQ-006
app.include_router(digest_router.router,           prefix="/api/v1/digest",         tags=["digest"])


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
