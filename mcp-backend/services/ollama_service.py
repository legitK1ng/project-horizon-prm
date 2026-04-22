"""
Ollama Service — Item 5
Cloud-hosted inference via Ollama using minimax-m2.7:cloud.
Model runs on MiniMax's remote cloud — zero local VRAM required.
Ollama daemon acts as the local proxy (default port 11434).

Setup:
  ollama pull minimax-m2.7:cloud
  ollama serve

API pattern (same as Claude Code / Codex / OpenCode agents):
  POST /api/chat  — chat/messages format (streaming or non-streaming)
  GET  /api/tags  — list registered models
"""
import os
import json
import logging
import httpx
from typing import Any

logger = logging.getLogger(__name__)

OLLAMA_BASE   = os.environ.get("OLLAMA_BASE_URL",      "http://localhost:11434")
DEFAULT_MODEL = os.environ.get("OLLAMA_DEFAULT_MODEL",  "minimax-m2.7:cloud")

# Cloud model — generous timeout for remote inference round-trip
TIMEOUT = int(os.environ.get("OLLAMA_TIMEOUT_SECONDS", "120"))


async def _chat(messages: list[dict], model: str, system: str = "") -> str:
    """
    POST /api/chat — the modern Ollama endpoint used by all launch agents
    (Claude Code, Codex, OpenCode, Droid).  Returns assistant content string.
    """
    payload: dict[str, Any] = {
        "model":    model,
        "messages": messages,
        "stream":   False,
    }
    if system:
        # Prepend system message
        payload["messages"] = [{"role": "system", "content": system}] + messages

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.post(f"{OLLAMA_BASE}/api/chat", json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data.get("message", {}).get("content", "")


async def generate(
    prompt: str,
    model: str = DEFAULT_MODEL,
    system: str = "",
) -> str:
    """
    Single-turn generation — wraps prompt as a user message for /api/chat.
    Drop-in replacement for the old /api/generate call.
    """
    logger.info(f"[Ollama] generate model={model} prompt_len={len(prompt)}")
    return await _chat(
        messages=[{"role": "user", "content": prompt}],
        model=model,
        system=system,
    )


async def chat(
    messages: list[dict],
    model: str = DEFAULT_MODEL,
    system: str = "",
) -> str:
    """
    Multi-turn chat — pass OpenAI-style messages list directly.
    Each message: {"role": "user"|"assistant", "content": "..."}
    """
    logger.info(f"[Ollama] chat model={model} turns={len(messages)}")
    return await _chat(messages=messages, model=model, system=system)


async def process_transcript(
    raw_transcript: str,
    model: str = DEFAULT_MODEL,
) -> dict:
    """
    Item 5 / 15 — Full transcript pipeline via minimax-m2.7:cloud.
    Single-pass: diarization → structuring → summary → action items → entities.
    Returns a structured dict matching the executive_brief schema.
    """
    system_prompt = (
        "You are an expert call analyst. "
        "Always respond with valid JSON only — no markdown, no prose outside the JSON object."
    )

    user_prompt = f"""Analyse this call transcript and return ONLY a valid JSON object with these exact keys:
{{
  "title": "Short descriptive title",
  "summary": "2-3 sentence executive summary",
  "sentiment": "Positive | Neutral | Negative",
  "action_items": ["concrete next step 1", "concrete next step 2"],
  "key_points": ["key discussion point 1", "key discussion point 2"],
  "speakers": ["Speaker A", "Speaker B"],
  "entities": [
    {{"name": "Acme Corp", "type": "organization"}},
    {{"name": "John Smith", "type": "person"}}
  ],
  "keywords": ["keyword1", "keyword2"],
  "recommended_followup_date": "YYYY-MM-DD",
  "draft_followup_message": "Personalised follow-up under 100 words",
  "open_commitments": [
    {{"commitment": "Send proposal", "deadline": "YYYY-MM-DD or null", "owner": "user | contact"}}
  ]
}}

TRANSCRIPT:
{raw_transcript}"""

    raw = await _chat(
        messages=[{"role": "user", "content": user_prompt}],
        model=model,
        system=system_prompt,
    )

    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("[Ollama] JSON parse failed; returning raw as summary.")
        return {
            "title":                    "Processing Error",
            "summary":                  raw[:500],
            "action_items":             [],
            "key_points":               [],
            "sentiment":                "Neutral",
            "speakers":                 [],
            "entities":                 [],
            "keywords":                 [],
            "recommended_followup_date": None,
            "draft_followup_message":   None,
            "open_commitments":         [],
        }


async def list_models() -> list[str]:
    """Return model names currently registered in Ollama (local + cloud)."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{OLLAMA_BASE}/api/tags")
            resp.raise_for_status()
            return [m["name"] for m in resp.json().get("models", [])]
    except Exception as e:
        logger.warning(f"[Ollama] Could not list models: {e}")
        return []


async def health_check() -> dict:
    """Verify local Ollama daemon is reachable."""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(f"{OLLAMA_BASE}/api/version")
            if resp.status_code == 200:
                return {
                    "status":   "ok",
                    "version":  resp.json().get("version"),
                    "base_url": OLLAMA_BASE,
                    "model":    DEFAULT_MODEL,
                }
            return {"status": "error", "code": resp.status_code}
    except Exception as e:
        return {
            "status":   "unreachable",
            "error":    str(e),
            "base_url": OLLAMA_BASE,
            "hint":     "Run: ollama serve",
        }
