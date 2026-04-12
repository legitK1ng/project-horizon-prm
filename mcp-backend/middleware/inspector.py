"""
Inspector Middleware & SSE Stream
Intercepts every request/response on the ingestion server.
Tap at: GET /v1/inspector  (Server-Sent Events)
"""
import json
import time
import asyncio
import logging
from collections import deque
from typing import AsyncGenerator

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import StreamingResponse

logger = logging.getLogger(__name__)

# In-memory ring buffer — stores the last 200 request/response events
_event_buffer: deque = deque(maxlen=200)
# Broadcast queue — active SSE listeners subscribe to this
_subscribers: list[asyncio.Queue] = []


def _broadcast(event: dict):
    """Push an event to all active /v1/inspector SSE subscribers."""
    payload = json.dumps(event, default=str)
    dead = []
    for q in _subscribers:
        try:
            q.put_nowait(payload)
        except asyncio.QueueFull:
            dead.append(q)
    for q in dead:
        _subscribers.remove(q)


class InspectorMiddleware(BaseHTTPMiddleware):
    """
    Captures every request/response cycle, stores it in the ring buffer,
    and broadcasts it to any connected SSE inspector clients.

    Skip the inspector endpoint itself to avoid infinite loops.
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # Don't inspect the inspector endpoint itself
        if request.url.path in ("/v1/inspector", "/v1/health"):
            return await call_next(request)

        start = time.perf_counter()

        # --- Capture request body ---
        body_bytes = await request.body()
        # Rebuild body so downstream can still read it
        async def receive():
            return {"type": "http.request", "body": body_bytes}
        request._receive = receive  # type: ignore

        req_event = {
            "ts": time.time(),
            "direction": "REQUEST",
            "method": request.method,
            "path": request.url.path,
            "headers": {
                k: ("***" if k.lower() == "authorization" else v)
                for k, v in request.headers.items()
            },
            "body_size": len(body_bytes),
            # Only stringify body if it's not binary (audio)
            "body_preview": body_bytes[:500].decode("utf-8", errors="replace")
            if not _is_binary(body_bytes)
            else f"<binary {len(body_bytes)} bytes>",
        }
        _event_buffer.append(req_event)
        _broadcast(req_event)

        # --- Call the actual endpoint ---
        response: Response = await call_next(request)
        elapsed_ms = (time.perf_counter() - start) * 1000

        # Capture response body
        resp_body = b""
        async for chunk in response.body_iterator:
            resp_body += chunk

        resp_event = {
            "ts": time.time(),
            "direction": "RESPONSE",
            "method": request.method,
            "path": request.url.path,
            "status": response.status_code,
            "elapsed_ms": round(elapsed_ms, 1),
            "body": resp_body.decode("utf-8", errors="replace"),
        }
        _event_buffer.append(resp_event)
        _broadcast(resp_event)

        # Return rebuilt response
        return Response(
            content=resp_body,
            status_code=response.status_code,
            headers=dict(response.headers),
            media_type=response.media_type,
        )


def _is_binary(data: bytes) -> bool:
    """Heuristic: if more than 10% non-printable bytes, treat as binary."""
    if not data:
        return False
    sample = data[:256]
    non_printable = sum(1 for b in sample if b < 9 or (13 < b < 32))
    return (non_printable / len(sample)) > 0.10


async def inspector_sse_stream() -> AsyncGenerator[str, None]:
    """SSE generator — yields buffered history then streams live events."""
    q: asyncio.Queue = asyncio.Queue(maxsize=500)
    _subscribers.append(q)

    try:
        # Replay history first so the client gets context
        for event in list(_event_buffer):
            yield f"data: {json.dumps(event, default=str)}\n\n"

        # Then stream live
        while True:
            try:
                payload = await asyncio.wait_for(q.get(), timeout=30.0)
                yield f"data: {payload}\n\n"
            except asyncio.TimeoutError:
                yield ": keepalive\n\n"
    finally:
        if q in _subscribers:
            _subscribers.remove(q)
