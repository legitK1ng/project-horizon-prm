"""
AI Briefing Service — AGENT-3a | REQ-006, REQ-027, REQ-033, REQ-034, REQ-035, REQ-036
Handles ALL Gemini interactions server-side. Frontend never calls Gemini directly.
"""
import os
import json
from datetime import datetime, timedelta, timezone

import google.generativeai as genai


def _get_model() -> genai.GenerativeModel:
    api_key = os.environ.get("GOOGLE_API_KEY", "")
    if not api_key:
        raise EnvironmentError("GOOGLE_API_KEY environment variable not set.")
    genai.configure(api_key=api_key)
    return genai.GenerativeModel("gemini-2.5-flash")


def generate_call_brief(transcript: str, contact_name: str) -> dict:
    """
    REQ-035: Generate proactive executive brief with followup date,
    draft message, open commitments, and deadline alerts.
    """
    model = _get_model()
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

    response = model.generate_content(prompt)
    text = response.text.strip()
    if text.startswith("```json"):
        text = text[7:]
    if text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]

    return json.loads(text.strip())


def generate_weekly_digest(call_summaries: list[dict]) -> str:
    """
    REQ-006: Generate a weekly digest paragraph from recent call summaries.
    Called by /api/v1/digest endpoint — never from frontend.
    """
    model = _get_model()

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

    response = model.generate_content(prompt)
    return response.text.strip()


def generate_nudge(contact_name: str, last_interaction: str, sentiment: str) -> str:
    """
    REQ-036: Generate a 1-sentence proactive nudge for a declining relationship.
    """
    model = _get_model()
    
    prompt = f"""
    Create a proactive, 1-sentence follow-up nudge for {contact_name}.
    Context:
    - Last meaningful contact: {last_interaction}
    - Most recent sentiment: {sentiment}
    
    The nudge should be low-friction, high-value, and encourage a simple check-in.
    Avoid generic 'checking in' phrases. Be specific but concise.
    """
    
    response = model.generate_content(prompt)
    return response.text.strip()


def classify_social_signal(content: str, contact_name: str) -> dict:
    """
    REQ-033: Classify a social signal from a contact into a structured category.
    """
    model = _get_model()

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

    response = model.generate_content(prompt)
    text = response.text.strip()
    if text.startswith("```json"):
        text = text[7:]
    if text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]

    return json.loads(text.strip())


def generate_reply_suggestion(signal_content: str, contact_name: str, call_history_summaries: list[str]) -> str:
    """
    REQ-034: Generate a personalized reply suggestion referencing shared call history.
    """
    model = _get_model()

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

    response = model.generate_content(prompt)
    return response.text.strip()


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
    # Recency: max 30 pts — decays over 60 days
    recency = max(0, 30 - (days_since_last_contact / 2))

    # Frequency: max 30 pts — 10 calls/month = full score
    frequency = min(30, calls_last_30_days * 3)

    # Sentiment: max 25 pts — avg_sentiment_score is 0.0 (negative) to 1.0 (positive)
    sentiment = avg_sentiment_score * 25

    # Response latency: max 15 pts — < 1 hour response = full score; > 72 hours = 0
    latency = max(0, 15 - (avg_response_latency_hours / 5))

    return round(min(100, recency + frequency + sentiment + latency), 2)
