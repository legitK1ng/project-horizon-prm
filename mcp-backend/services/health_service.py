from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from db.supabase_client import get_supabase

# REQ-035: Health Score Engine
# Calculates relationship health (0-100) using 3-tier weighting: Recency (40%), Frequency (30%), Sentiment (30%).

_SENTIMENT_MAP = {"Positive": 1.0, "Neutral": 0.5, "Negative": 0.0}


def _score_from_calls(calls: list, now: datetime) -> tuple[float, str | None]:
    """Compute (health_score, last_contact_at) from a pre-fetched list of call rows."""
    if not calls:
        return 0.0, None

    one_month_ago = now - timedelta(days=30)
    calls_sorted = sorted(calls, key=lambda c: c["timestamp"], reverse=True)

    last_call_at = datetime.fromisoformat(calls_sorted[0]["timestamp"].replace("Z", "+00:00"))
    days_since = (now - last_call_at).days
    recency_score = max(0.0, 1.0 - (days_since / 30.0))

    recent_calls = [
        c for c in calls
        if datetime.fromisoformat(c["timestamp"].replace("Z", "+00:00")) > one_month_ago
    ]
    frequency_score = min(1.0, len(recent_calls) / 4.0)

    sentiment_values = [_SENTIMENT_MAP.get(c.get("sentiment", "Neutral"), 0.5) for c in calls_sorted[:5]]
    sentiment_score = sum(sentiment_values) / len(sentiment_values)

    score = round((recency_score * 0.4 + frequency_score * 0.3 + sentiment_score * 0.3) * 100.0, 2)
    return score, calls_sorted[0]["timestamp"]


def calculate_health_score(contact_id: str) -> float:
    """Calculates the current health score for a specific contact."""
    supabase = get_supabase()
    response = supabase.table("call_records") \
        .select("timestamp, sentiment") \
        .eq("contact_id", contact_id) \
        .order("timestamp", desc=True) \
        .limit(10) \
        .execute()
    score, _ = _score_from_calls(response.data or [], datetime.now(timezone.utc))
    return score


def update_contact_health(contact_id: str):
    """Updates health_score and last_contact_at for one contact in a single query pair."""
    supabase = get_supabase()
    response = supabase.table("call_records") \
        .select("timestamp, sentiment") \
        .eq("contact_id", contact_id) \
        .order("timestamp", desc=True) \
        .limit(10) \
        .execute()

    now = datetime.now(timezone.utc)
    score, last_contact_at = _score_from_calls(response.data or [], now)

    supabase.table("contacts") \
        .update({
            "health_score": score,
            "last_contact_at": last_contact_at,
            "updated_at": now.isoformat(),
        }) \
        .eq("id", contact_id) \
        .execute()


def refresh_all_health_scores():
    """
    Batch-recompute health scores for all contacts with call history.
    Uses 2 queries total instead of 3×N (one fetch, one batch upsert).
    """
    supabase = get_supabase()

    # Single query — fetch all call records that have a contact link
    response = supabase.table("call_records") \
        .select("contact_id, timestamp, sentiment") \
        .not_.is_("contact_id", "null") \
        .execute()

    if not response.data:
        return

    # Group by contact in Python
    by_contact: dict[str, list] = defaultdict(list)
    for row in response.data:
        by_contact[row["contact_id"]].append(row)

    now = datetime.now(timezone.utc)
    updates = []
    for contact_id, calls in by_contact.items():
        score, last_contact_at = _score_from_calls(calls, now)
        updates.append({
            "id": contact_id,
            "health_score": score,
            "last_contact_at": last_contact_at,
            "updated_at": now.isoformat(),
        })

    # Single batch upsert — one round-trip for all contacts
    if updates:
        supabase.table("contacts").upsert(updates, on_conflict="id").execute()
