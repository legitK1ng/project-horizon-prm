"""
OSINT Photo Enrichment Service
Collects multiple candidate profile photos per contact from:
1. Google People API (raw_data.photos[])
2. Gravatar via email MD5 hash
3. Social search link construction for manual dorking

Results are returned as a list of photo candidate URLs for user selection.
The user selects a primary photo via PATCH /api/v1/contacts/{id}/photo.
"""
import hashlib
import json
import logging
from typing import List, Optional

logger = logging.getLogger(__name__)


def _extract_google_photos(raw_data: Optional[dict]) -> List[str]:
    """Extract photo URLs from Google People API raw_data JSONB."""
    if not raw_data:
        return []
    
    photos = raw_data.get("photos", [])
    results = []
    for photo in photos:
        url = photo.get("url") or photo.get("value")
        if url and url not in results:
            # Google contacts photos need referrerPolicy=no-referrer to load cross-origin
            results.append(url)
    return results


def _gravatar_url(email: Optional[str], size: int = 200) -> Optional[str]:
    """Construct Gravatar URL from email MD5 hash."""
    if not email or "@" not in email:
        return None
    normalized = email.strip().lower()
    md5 = hashlib.md5(normalized.encode("utf-8")).hexdigest()
    # d=404 means return 404 if no Gravatar (don't show generic avatar)
    return f"https://www.gravatar.com/avatar/{md5}?s={size}&d=404"


def _linkedin_search_url(first_name: str, last_name: Optional[str], organization: Optional[str]) -> str:
    """Construct Google dork for LinkedIn profile (frontend uses this as a link)."""
    name = f"{first_name} {last_name or ''}".strip()
    qualifier = f" {organization}" if organization else ""
    query = f'site:linkedin.com/in "{name}"{qualifier}'
    return f"https://www.google.com/search?q={query.replace(' ', '+')}"


def _twitter_search_url(first_name: str, last_name: Optional[str]) -> str:
    """Construct Twitter/X people search URL."""
    name = f"{first_name} {last_name or ''}".strip()
    return f"https://twitter.com/search?q={name.replace(' ', '%20')}&f=user"


async def collect_photo_candidates(contact: dict) -> dict:
    """
    Main enrichment function — collects all available photo sources for a contact.
    Returns a dict with:
        - candidates: list of photo URLs to show the user
        - dork_links: strategic search links for manual enrichment
    """
    candidates: List[str] = []
    
    # 1. Google People API photos (from sync raw_data)
    raw_data = contact.get("raw_data") or {}
    if isinstance(raw_data, str):
        try:
            raw_data = json.loads(raw_data)
        except Exception:
            raw_data = {}
    
    google_photos = _extract_google_photos(raw_data)
    candidates.extend(google_photos)
    
    # 2. Gravatar (email-based)
    email = contact.get("email")
    gravatar = _gravatar_url(email)
    if gravatar and gravatar not in candidates:
        candidates.append(gravatar)
    
    # 3. Current photo_url (not from Google — might be a manually set URL)
    existing = contact.get("photo_url")
    if existing and existing not in candidates:
        candidates.insert(0, existing)  # Current photo always first
    
    # Build dork links for manual search
    first_name = contact.get("first_name", "")
    last_name = contact.get("last_name")
    organization = contact.get("organization")
    phone = contact.get("phone")
    location = contact.get("location", "MN")  # Default MN per user requirement
    
    dork_links = {
        "linkedin": _linkedin_search_url(first_name, last_name, organization),
        "twitter": _twitter_search_url(first_name, last_name),
        "image_search": (
            f"https://www.google.com/search?tbm=isch&q="
            f"{(f'{first_name}+{last_name}' if last_name else first_name)}"
            f"{f'+{organization}' if organization else ''}"
            f"+{location}"
        ),
    }
    
    if phone:
        dork_links["phone_dork"] = f"https://www.google.com/search?q=%22{phone}%22"
    
    return {
        "contact_id": contact.get("id"),
        "candidates": candidates,
        "candidate_count": len(candidates),
        "dork_links": dork_links,
    }
