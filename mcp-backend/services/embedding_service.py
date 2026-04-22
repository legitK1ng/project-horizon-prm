"""
Embedding Service — Horizon PRM
Default: Google text-embedding-004 (768-dim, API key already configured)
Upgrade:  Set VOYAGE_API_KEY → switches to voyage-3-large (1024-dim, Anthropic-recommended)

Voyage upgrade path:
  1. Add VOYAGE_API_KEY to .env
  2. Run: python mcp-backend/scripts/reembed_all.py
     (migrates column to vector(1024) and re-embeds all existing records)
"""
import os
import logging

logger = logging.getLogger(__name__)

VOYAGE_API_KEY = os.environ.get("VOYAGE_API_KEY")
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "")

EMBEDDING_DIM   = 1024 if VOYAGE_API_KEY else 3072
EMBEDDING_MODEL = "voyage-3-large" if VOYAGE_API_KEY else "gemini-embedding-001"


def embed_text(text: str) -> list[float]:
    """Embed a single document string."""
    if not text or not text.strip():
        return []
    text = text[:30000]  # hard cap — voyage supports 32k tokens
    try:
        if VOYAGE_API_KEY:
            return _voyage([text], input_type="document")[0]
        return _google(text, task_type="retrieval_document")
    except Exception as e:
        logger.error(f"[Embed] embed_text failed: {e}")
        return []


def embed_query(text: str) -> list[float]:
    """Embed a search query (asymmetric retrieval — different task_type)."""
    if not text or not text.strip():
        return []
    try:
        if VOYAGE_API_KEY:
            return _voyage([text], input_type="query")[0]
        return _google(text, task_type="retrieval_query")
    except Exception as e:
        logger.error(f"[Embed] embed_query failed: {e}")
        return []


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Batch embed multiple document strings."""
    if not texts:
        return []
    try:
        if VOYAGE_API_KEY:
            return _voyage(texts, input_type="document")
        return [_google(t, task_type="retrieval_document") for t in texts]
    except Exception as e:
        logger.error(f"[Embed] embed_texts failed: {e}")
        return [[] for _ in texts]


# ── Providers ─────────────────────────────────────────────────────────────────

def _google(text: str, task_type: str = "retrieval_document") -> list[float]:
    import httpx
    resp = httpx.post(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent",
        headers={"x-goog-api-key": GOOGLE_API_KEY},
        json={
            "model": "models/gemini-embedding-001",
            "content": {"parts": [{"text": text}]},
            "taskType": task_type.upper().replace("-", "_"),
        },
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()["embedding"]["values"]


def _voyage(texts: list[str], input_type: str = "document") -> list[list[float]]:
    import voyageai
    client = voyageai.Client(api_key=VOYAGE_API_KEY)
    all_embeddings: list[list[float]] = []
    for i in range(0, len(texts), 128):  # voyage max batch = 128
        batch = texts[i : i + 128]
        result = client.embed(batch, model="voyage-3-large", input_type=input_type)
        all_embeddings.extend(result.embeddings)
    return all_embeddings


def active_model() -> str:
    return EMBEDDING_MODEL


def active_dim() -> int:
    return EMBEDDING_DIM
