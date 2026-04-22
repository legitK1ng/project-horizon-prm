"""
SSE Events Router — Item 18
Server-Sent Events for real-time UI updates:
  - Incoming transcripts
  - Call log changes
  - Task/project updates
  - Enrichment progress
"""
import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import AsyncGenerator

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

logger = logging.getLogger(__name__)
router = APIRouter()

# In-memory event bus (replace with Redis pub/sub for multi-worker production)
_subscribers: list[asyncio.Queue] = []


def broadcast(event_type: str, payload: dict):
    """
    Push an event to all connected SSE clients.
    Call this from any router/service when state changes.

    Example:
        from routers.events import broadcast
        broadcast("task:update", {"id": task_id, "status": "completed"})
    """
    event = json.dumps({
        "type": event_type,
        "payload": payload,
        "ts": datetime.now(timezone.utc).isoformat(),
    })
    dead = []
    for q in _subscribers:
        try:
            q.put_nowait(event)
        except asyncio.QueueFull:
            dead.append(q)
    for q in dead:
        _subscribers.remove(q)


async def _event_generator(request: Request, queue: asyncio.Queue) -> AsyncGenerator[str, None]:
    """Yield SSE-formatted messages until the client disconnects."""
    _subscribers.append(queue)
    try:
        # Send an initial connection confirmation
        yield f"data: {json.dumps({'type': 'connected', 'ts': datetime.now(timezone.utc).isoformat()})}\n\n"

        while True:
            if await request.is_disconnected():
                break
            try:
                # Wait up to 25 s for an event, then send a heartbeat
                msg = await asyncio.wait_for(queue.get(), timeout=25)
                yield f"data: {msg}\n\n"
            except asyncio.TimeoutError:
                # Heartbeat keeps the connection alive through proxies
                yield ": heartbeat\n\n"
    finally:
        _subscribers.remove(queue)
        logger.debug("[SSE] Client disconnected")


@router.get("/stream")
async def event_stream(request: Request):
    """
    SSE endpoint — frontend connects here with EventSource.
    Item 18: real-time updates for transcripts, call logs, tasks.
    """
    queue: asyncio.Queue = asyncio.Queue(maxsize=100)
    return StreamingResponse(
        _event_generator(request, queue),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",   # Disable Nginx buffering
            "Connection": "keep-alive",
        },
    )


@router.post("/broadcast")
async def manual_broadcast(event_type: str, payload: dict = {}):
    """
    Internal utility endpoint for testing — broadcast an event to all clients.
    Remove or restrict in production.
    """
    broadcast(event_type, payload)
    return {"status": "broadcast", "subscribers": len(_subscribers)}
