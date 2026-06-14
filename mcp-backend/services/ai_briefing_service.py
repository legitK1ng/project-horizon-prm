"""
AI Briefing Service — AGENT-3a | REQ-006, REQ-027, REQ-033, REQ-034, REQ-035, REQ-036
Handles ALL Gemini interactions server-side. Frontend never calls Gemini directly.
Migrated to google-genai (v2) SDK — replaces deprecated google-generativeai.
"""
import os
import json
from datetime import datetime, timezone

from google import genai
from google.genai import types


def _get_client() -> genai.Client:
    api_key = os.environ.get("GOOGLE_API_KEY", "")
    if not api_key:
        raise EnvironmentError("GOOGLE_API_KEY environment variable not set.")
    return genai.Client(api_key=api_key)


def _generate(prompt: str, model: str = "gemini-2.0-flash") -> str:
    """Single-call helper — returns response text, strips markdown fences."""
    client = _get_client()
    response = client.models.generate_content(model=model, contents=prompt)
    text = response.text.strip()
    # Strip markdown code fences if model wrapped the JSON
    for fence in ("```json", "```"):
        if text.startswith(fence):
            text = text[len(fence):]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()


def generate_call_brief(transcript: str, contact_name: str) -> dict:
    """
    REQ-035: Generate proactive executive brief with followup date,
    draft message, open commitments, and deadline alerts.
    """
    today = datetime.now(timezone.utc).date().isoformat()

    prompt = f"""
    Analyze this call transcript and return ONLY valid JSON with EXACTLY this structure:
    {{
        "title": "Short descriptive title",
        "summary": "1-2 sentence summary",
        "sentiment": "Positive | Negative | Neutral",
        "tags": ["tag1", "tag2"],
        "actionItems": ["Action 1", "Action 2"],
        "recommended_followup_date": "YYYY-MM-DD (1-2 weeks from {today})",
        "draft_followup_message": "A personalized follow-up message under 150 words referencing the call",
        "open_commitments": [
            {{"commitment": "Description", "deadline": "YYYY-MM-DD or null", "owner": "user | contact"}}
        ],
        "commitment_deadline_alerts": ["Alert if any commitment deadline is within 48 hours"]
    }}

    Contact: {contact_name}
    Today: {today}
    Transcript:
    {transcript}
    """

    return json.loads(_generate(prompt))


def generate_weekly_digest(call_summaries: list[dict]) -> str:
    """
    REQ-006: Generate a weekly digest paragraph from recent call summaries.
    Called by /api/v1/digest endpoint — never from frontend.
    """
    if not call_summaries:
        return "No relationship activity recorded this week."

    summaries_text = "\n".join([
        f"- {s.get('contact_name', 'Unknown')}: {s.get('summary', 'No summary')}"
        for s in call_summaries[:20]
    ])

    prompt = f"""
    Write a concise, insightful weekly relationship intelligence digest (1-2 paragraphs).
    Synthesize the following call summaries into a narrative that highlights:
    - Key relationship momentum
    - Notable developments or action items
    - Suggested focus areas for next week

    Do not list items — write flowing, intelligent prose.

    Recent Activity:
    {summaries_text}
    """

    return _generate(prompt)


def generate_nudge(contact_name: str, last_interaction: str, sentiment: str) -> str:
    """
    REQ-036: Generate a 1-sentence proactive nudge for a declining relationship.
    """
    prompt = f"""
    Create a proactive, 1-sentence follow-up nudge for {contact_name}.
    Context:
    - Last meaningful contact: {last_interaction}
    - Most recent sentiment: {sentiment}

    The nudge should be low-friction, high-value, and encourage a simple check-in.
    Avoid generic 'checking in' phrases. Be specific but concise.
    """
    return _generate(prompt)


def classify_social_signal(content: str, contact_name: str) -> dict:
    """
    REQ-033: Classify a social signal from a contact into a structured category.
    """
    prompt = f"""
    Classify this social media post from {contact_name} into EXACTLY one category.
    Return ONLY valid JSON with this structure:
    {{
        "category": "Life Event | Professional Milestone | Market signal | General",
        "importance": 1-5,
        "summary": "Short 1-sentence context",
        "suggested_action": "Optional brief suggestion"
    }}

    Content:
    {content}
    """
    return json.loads(_generate(prompt))


def generate_reply_suggestion(signal_content: str, contact_name: str, call_history_summaries: list[str]) -> str:
    """
    REQ-034: Generate a personalized reply suggestion referencing shared call history.
    """
    history_context = "\n".join(call_history_summaries[:5]) if call_history_summaries else "No prior call history."

    prompt = f"""
    {contact_name} posted the following on social media:
    "{signal_content}"

    Your shared call history includes:
    {history_context}

    Write a brief, genuine, personalized reply (2-3 sentences max) that:
    - References something from your shared history
    - Responds thoughtfully to their post
    - Does not sound robotic or generic

    Return ONLY the reply text, no JSON.
    """
    return _generate(prompt)


def compute_relationship_strength_score(
    days_since_last_contact: int,
    calls_last_30_days: int,
    avg_sentiment_score: float,
    avg_response_latency_hours: float
) -> float:
    """
    REQ-036: Compute Relationship Strength Score (0-100).
    Composite of: recency, frequency, sentiment trend, response latency.
    """
    recency   = max(0, 30 - (days_since_last_contact / 2))
    frequency = min(30, calls_last_30_days * 3)
    sentiment = avg_sentiment_score * 25
    latency   = max(0, 15 - (avg_response_latency_hours / 5))
    return round(min(100, recency + frequency + sentiment + latency), 2)


def chat_gemini_sync(prompt: str) -> str:
    """
    REQ-027: Contextual Assistant Chat via Gemini.
    """
    return _generate(prompt)


# ── Transcript Pipeline (Item 5 / 15) — Gemini ───────────────────────────────

def process_transcript_gemini(transcript: str, contact_name: str = "Unknown") -> dict:
    """
    Item 5: Full transcript pipeline via Gemini 2.0 Flash.
    Stages: speaker structuring → summary → action items → entity extraction.
    """
    today = datetime.now(timezone.utc).date().isoformat()

    prompt = f"""Analyse this call transcript and return ONLY valid JSON with this structure:
{{
  "title": "Short descriptive title",
  "summary": "2-3 sentence executive summary",
  "sentiment": "Positive | Neutral | Negative",
  "action_items": ["Action 1", "Action 2"],
  "key_points": ["Key point 1", "Key point 2"],
  "speakers": ["Speaker A", "Speaker B"],
  "entities": [
    {{"name": "Acme Corp", "type": "organization"}},
    {{"name": "John Smith", "type": "person"}}
  ],
  "keywords": ["keyword1", "keyword2"],
  "recommended_followup_date": "YYYY-MM-DD",
  "draft_followup_message": "Personalized follow-up under 100 words",
  "open_commitments": [
    {{"commitment": "Send proposal", "deadline": "YYYY-MM-DD or null", "owner": "user | contact"}}
  ]
}}

Contact: {contact_name}
Today: {today}

TRANSCRIPT:
{transcript}

Return ONLY the JSON object."""

    return json.loads(_generate(prompt))


# ── Embeddings (Item 14) — Google text-embedding-004 ─────────────────────────

def generate_embedding(text: str) -> list[float]:
    """
    Item 14: Generate a 768-dim embedding via Google text-embedding-004.
    Used for semantic search over contacts, transcripts, tasks, projects.
    """
    client = _get_client()
    result = client.models.embed_content(
        model="models/text-embedding-004",
        contents=text,
    )
    return result.embeddings[0].values
