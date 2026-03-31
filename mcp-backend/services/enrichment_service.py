"""
Enrichment Service — AGENT-3a | REQ-028, REQ-029, REQ-023
6-stage async enrichment pipeline per contact trigger.
Each stage runs independently, is retriable, and stores
results with source attribution and confidence level.
"""
import os
import uuid
import asyncio
import httpx
from datetime import datetime, timezone
from enum import Enum
from typing import Any

from db.supabase_client import get_supabase


class EnrichmentStage(int, Enum):
    ENTITY_DETECTION = 1
    PHONE_LOOKUP = 2
    EMAIL_ENRICHMENT = 3
    ORG_ENRICHMENT = 4
    SOCIAL_DISCOVERY = 5
    AI_SYNTHESIS = 6


class Confidence(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


def _conf_from_score(score: float) -> str:
    if score >= 0.8:
        return Confidence.HIGH
    elif score >= 0.5:
        return Confidence.MEDIUM
    return Confidence.LOW


def _save_job_result(job_id: str, stage: int, result: dict, source: str, confidence: str):
    """Persist a stage result to enrichment_jobs table."""
    db = get_supabase()
    db.table("enrichment_jobs").update({
        "status": "COMPLETE",
        "stage": stage,
        "result_json": result,
        "source_name": source,
        "confidence": confidence,
        "fetched_at": datetime.now(timezone.utc).isoformat()
    }).eq("id", job_id).execute()


def _fail_job(job_id: str, attempts: int, error: str):
    """Mark a job as FAILED or DEAD_LETTER after max retries."""
    db = get_supabase()
    status = "DEAD_LETTER" if attempts >= 3 else "FAILED"
    db.table("enrichment_jobs").update({
        "status": status,
        "attempts": attempts,
        "error_message": error,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }).eq("id", job_id).execute()


async def _stage_phone_lookup(phone: str) -> dict:
    """REQ-028 Stage 2: NumVerify reverse phone lookup."""
    api_key = os.environ.get("NUMVERIFY_API_KEY", "")
    if not api_key:
        return {"error": "NUMVERIFY_API_KEY not configured", "valid": False}

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            "http://apilayer.net/api/validate",
            params={"access_key": api_key, "number": phone, "format": 1}
        )
        data = resp.json()

    return {
        "carrier": data.get("carrier"),
        "line_type": data.get("line_type"),
        "geo_region": data.get("location"),
        "country_code": data.get("country_code"),
        "validity": data.get("valid", False)
    }


async def _stage_email_enrichment(email: str) -> dict:
    """REQ-028 Stage 3: Hunter.io email enrichment."""
    api_key = os.environ.get("HUNTER_API_KEY", "")
    if not api_key:
        return {"error": "HUNTER_API_KEY not configured"}

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            "https://api.hunter.io/v2/email-finder",
            params={"email": email, "api_key": api_key}
        )
        if resp.status_code != 200:
            return {"error": f"Hunter.io error: {resp.status_code}", "raw": resp.text}
        
        data = resp.json().get("data", {})

    return {
        "name": f"{data.get('first_name', '')} {data.get('last_name', '')}".strip(),
        "title": data.get("position"),
        "employer": data.get("company"),
        "social_handles": {"twitter": data.get("twitter"), "linkedin": data.get("linkedin")},
        "confidence": (data.get("score", 0) / 100)
    }


async def _stage_org_enrichment(company_domain: str) -> dict:
    """REQ-028 Stage 4: Clearbit Company enrichment."""
    api_key = os.environ.get("CLEARBIT_API_KEY", "")
    if not api_key:
        return {"error": "CLEARBIT_API_KEY not configured"}

    async with httpx.AsyncClient(timeout=10, headers={"Authorization": f"Bearer {api_key}"}) as client:
        resp = await client.get(f"https://company.clearbit.com/v2/companies/find?domain={company_domain}")
        if resp.status_code != 200:
            return {"error": f"Clearbit error: {resp.status_code}", "domain": company_domain}
            
        data = resp.json()

    return {
        "name": data.get("name"),
        "legal_name": data.get("legalName"),
        "industry": data.get("category", {}).get("industry"),
        "sub_industry": data.get("category", {}).get("subIndustry"),
        "size": data.get("metrics", {}).get("employees"),
        "funding": data.get("metrics", {}).get("raised"),
        "website": data.get("domain"),
        "description": data.get("description"),
        "logo_url": data.get("logo")
    }


async def _stage_social_discovery(name: str, email: str) -> dict:
    """REQ-028 Stage 5: Cross-reference email/name to social profiles (OSINT)."""
    # In production: integrate with FullContact or similar OSINT aggregator
    # Placeholder returns structured empty with correct schema
    return {
        "linkedin_url": None,
        "x_handle": None,
        "photo_url": None,
        "bio": None,
        "location": None
    }


async def _stage_ai_synthesis(contact_name: str, enrichment_data: dict) -> dict:
    """REQ-028 Stage 6: Gemini synthesizes enrichment data into a 'Who is this person' narrative."""
    from services.ai_briefing_service import _get_model

    model = _get_model()
    prompt = f"""
    Based on the following enrichment data, write a concise 'Who is this person' intelligence brief (3-4 sentences).
    Focus on: professional background, organizational role, relationship context.

    Contact: {contact_name}
    Enrichment Data: {enrichment_data}

    Return ONLY the narrative text, no JSON.
    """
    response = model.generate_content(prompt)
    return {"narrative": response.text.strip()}


async def run_enrichment_pipeline(contact_id: str, phone: str = None, email: str = None,
                                   company_domain: str = None, contact_name: str = "Unknown"):
    """
    REQ-028: Run the full 6-stage enrichment pipeline for a contact.
    Each stage is independently retriable. Results accumulate into enrichment_data.
    """
    db = get_supabase()
    enrichment_data = {}

    async def run_stage(stage: EnrichmentStage, coro, source: str):
        """Run a single stage with retry logic (REQ-023)."""
        job_resp = db.table("enrichment_jobs").insert({
            "contact_id": contact_id,
            "stage": stage.value,
            "status": "IN_PROGRESS",
            "attempts": 1
        }).execute()
        job_id = job_resp.data[0]["id"]

        for attempt in range(1, 4):
            try:
                result = await coro
                confidence_score = result.get("confidence", 0.7) if isinstance(result, dict) else 0.7
                _save_job_result(job_id, stage.value, result, source, _conf_from_score(confidence_score))
                return result
            except Exception as e:
                if attempt == 3:
                    _fail_job(job_id, attempt, str(e))
                    return {}
                await asyncio.sleep(2 ** attempt)  # Exponential backoff

    # Stage 1: Entity Detection (just record the job)
    db.table("enrichment_jobs").insert({
        "contact_id": contact_id, "stage": 1, "status": "COMPLETE",
        "result_json": {"job_id": str(uuid.uuid4()), "status": "triggered"},
        "source_name": "system", "confidence": "HIGH",
        "fetched_at": datetime.now(timezone.utc).isoformat()
    }).execute()

    # Stage 2: Phone
    if phone:
        result = await run_stage(EnrichmentStage.PHONE_LOOKUP, _stage_phone_lookup(phone), "numverify")
        enrichment_data["phone"] = result

    # Stage 3: Email
    if email:
        result = await run_stage(EnrichmentStage.EMAIL_ENRICHMENT, _stage_email_enrichment(email), "hunter.io")
        enrichment_data["email"] = result

    # Stage 4: Org
    if company_domain:
        result = await run_stage(EnrichmentStage.ORG_ENRICHMENT, _stage_org_enrichment(company_domain), "clearbit")
        enrichment_data["org"] = result

    # Stage 5: Social Discovery
    result = await run_stage(EnrichmentStage.SOCIAL_DISCOVERY, _stage_social_discovery(contact_name, email or ""), "osint")
    enrichment_data["social"] = result

    # Stage 6: AI Synthesis
    result = await run_stage(EnrichmentStage.AI_SYNTHESIS, _stage_ai_synthesis(contact_name, enrichment_data), "gemini")
    enrichment_data["synthesis"] = result

    return enrichment_data


def apply_user_override(entity_id: str, field_value: str, user_id: str):
    """
    REQ-029: User overrides a single enriched field.
    Persists override_by=user, override_at timestamp.
    """
    db = get_supabase()
    db.table("entities").update({
        "value": field_value,
        "override_by": "user",
        "override_at": datetime.now(timezone.utc).isoformat()
    }).eq("id", entity_id).execute()
