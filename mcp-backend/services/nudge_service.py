from datetime import datetime, timezone
from typing import List, Dict

from db.supabase_client import init_supabase
from services.ai_briefing_service import generate_nudge
from services.health_service import calculate_health_score

# REQ-036: Proactive Nudging
# Automatically triggers follow-up suggestions for relationships that "Need Attention".

def get_at_risk_contacts(limit: int = 5) -> List[Dict]:
    """
    Identifies contacts with low health scores or missing follow-ups.
    """
    supabase = init_supabase()
    
    # Fetch contacts with low health scores (populated by health_service)
    # or contacts that haven't been contacted in 3 weeks.
    response = supabase.table("contacts") \
        .select("id, first_name, last_name, health_score, last_contact_at, organization") \
        .lt("health_score", 40) \
        .order("health_score", desc=False) \
        .limit(limit) \
        .execute()
    
    return response.data

def generate_strategic_nudges() -> List[Dict]:
    """
    Generates a list of actionable nudges for at-risk contacts.
    """
    at_risk = get_at_risk_contacts()
    nudges = []
    
    for contact in at_risk:
        first_name = contact.get('first_name', 'Unknown')
        last_name = contact.get('last_name', '')
        full_name = f"{first_name} {last_name}".strip()
        last_at = contact.get('last_contact_at', 'Long ago')
        sentiment = "Neutral" # We could fetch this from recent calls
        
        # Generate the AI nudge text
        nudge_text = generate_nudge(full_name, last_at, sentiment)
        
        nudges.append({
            "contact_id": contact['id'],
            "contact_name": full_name,
            "organization": contact.get('organization'),
            "health_score": contact.get('health_score'),
            "nudge_text": nudge_text,
            "type": "health_warning" if contact.get('health_score', 0) < 40 else "followup"
        })
    
    return nudges

def check_immediate_alerts() -> List[Dict]:
    """
    Checks for high-priority alerts like missed commitments.
    """
    supabase = init_supabase()
    now = datetime.now(timezone.utc).date()
    
    # Fetch upcoming recommended follow-up dates
    response = supabase.table("call_records") \
        .select("id, contact_id, contact_name, recommended_followup_date") \
        .eq("status", "completed") \
        .lte("recommended_followup_date", now.isoformat()) \
        .execute()
    
    alerts = []
    for record in response.data:
        alerts.append({
            "contact_id": record['contact_id'],
            "contact_name": record['contact_name'],
            "reason": "Missed recommended follow-up date",
            "date": record['recommended_followup_date']
        })
    
    return alerts
