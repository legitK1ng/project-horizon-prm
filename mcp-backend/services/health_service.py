from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import List, Optional

from db.supabase_client import init_supabase

# REQ-035: Health Score Engine
# Calculates relationship health (0-100) using 3-tier weighting: Recency (40%), Frequency (30%), Sentiment (30%).

def calculate_health_score(contact_id: str) -> float:
    """
    Calculates the current health score for a specific contact.
    """
    supabase = init_supabase()
    now = datetime.now(timezone.utc)
    one_month_ago = now - timedelta(days=30)
    
    # 1. Fetch recent call records for context
    response = supabase.table("call_records") \
        .select("timestamp, sentiment") \
        .eq("contact_id", contact_id) \
        .order("timestamp", desc=True) \
        .limit(10) \
        .execute()
    
    calls = response.data
    if not calls:
        return 0.0 # No interactions = base zero health
    
    # --- A. RECENCY (40%) ---
    last_call_at = datetime.fromisoformat(calls[0]['timestamp'].replace('Z', '+00:00'))
    days_since = (now - last_call_at).days
    # Score decays to 0 over 30 days of inactivity
    recency_score = max(0.0, 1.0 - (days_since / 30.0))
    
    # --- B. FREQUENCY (30%) ---
    # Count calls in the last 30 days
    recent_calls = [c for c in calls if datetime.fromisoformat(c['timestamp'].replace('Z', '+00:00')) > one_month_ago]
    # Optimal frequency is 1 call per week (4 per month)
    frequency_score = min(1.0, len(recent_calls) / 4.0)
    
    # --- C. SENTIMENT (30%) ---
    # Map text sentiment to numeric values
    sentiment_map = {"Positive": 1.0, "Neutral": 0.5, "Negative": 0.0}
    sentiment_values = [sentiment_map.get(c.get('sentiment', 'Neutral'), 0.5) for c in calls[:5]]
    sentiment_score = sum(sentiment_values) / len(sentiment_values) if sentiment_values else 0.5
    
    # --- D. COMPOSE FINAL SCORE ---
    final_score = (
        (recency_score * 0.4) + 
        (frequency_score * 0.3) + 
        (sentiment_score * 0.3)
    ) * 100.0
    
    return round(float(final_score), 2)

def update_contact_health(contact_id: str):
    """
    Updates the health_score and last_contact_at in the Supabase contacts table.
    """
    supabase = init_supabase()
    score = calculate_health_score(contact_id)
    
    # Get the timestamp of the actual last call
    response = supabase.table("call_records") \
        .select("timestamp") \
        .eq("contact_id", contact_id) \
        .order("timestamp", desc=True) \
        .limit(1) \
        .execute()
    
    last_contact_at = response.data[0]['timestamp'] if response.data else None
    
    supabase.table("contacts") \
        .update({
            "health_score": score,
            "last_contact_at": last_contact_at,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }) \
        .eq("id", contact_id) \
        .execute()

def refresh_all_health_scores():
    """
    Batch update for all active contacts.
    """
    supabase = init_supabase()
    # Fetch all contacts with at least one call record
    response = supabase.rpc("get_contacts_with_interactions", {}).execute()
    
    for contact in response.data:
        update_contact_health(contact['id'])
