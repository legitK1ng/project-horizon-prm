"""
Enrichments Router — AGENT-3a | REQ-023, REQ-028, REQ-029
Handles triggering and listing enrichment jobs for contacts.
"""
from fastapi import APIRouter, Request, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional

from services.enrichment_service import run_enrichment_pipeline, apply_user_override

router = APIRouter()

class EnrichmentTriggerRequest(BaseModel):
    contact_id: str

class EnrichmentOverrideRequest(BaseModel):
    entity_id: str
    value: str

@router.post("/")
async def trigger_enrichment(req: Request, body: EnrichmentTriggerRequest, background_tasks: BackgroundTasks):
    """REQ-028: POST /api/v1/enrichments — Trigger the async enrichment pipeline."""
    db = getattr(req.app.state, "supabase", None)
    if not db:
        raise HTTPException(status_code=503, detail="Database not available")

    # Fetch contact details to pass to enrichment pipe
    try:
        contact_resp = db.table("contacts").select("*").eq("id", body.contact_id).single().execute()
        contact = contact_resp.data

        # REQ-023: Trigger background task
        background_tasks.add_task(
            run_enrichment_pipeline,
            contact_id=body.contact_id,
            phone=contact.get("phone"),
            email=contact.get("email"),
            company_domain=contact.get("organization"), # using organization as domain for org lookup logic
            contact_name=f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip()
        )

        return {"status": "success", "message": "Enrichment pipeline triggered", "job_ids": []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to find contact: {str(e)}")

@router.get("/")
async def list_enrichments(req: Request, contact_id: str):
    """REQ-028: GET /api/v1/enrichments — List enrichment jobs for a contact."""
    db = getattr(req.app.state, "supabase", None)
    if not db:
        raise HTTPException(status_code=503, detail="Database not available")

    try:
        response = db.table("enrichment_jobs").select("*").eq("contact_id", contact_id).order("stage").execute()
        return {"status": "success", "data": response.data, "count": len(response.data)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{contact_id}/photos")
async def get_contact_photo_candidates(req: Request, contact_id: str):
    """REQ-028: GET /api/v1/enrichments/{contact_id}/photos — Get candidate photos for a contact."""
    db = getattr(req.app.state, "supabase", None)
    if not db:
        raise HTTPException(status_code=503, detail="Database not available")

    try:
        from services.photo_enrichment_service import collect_photo_candidates
        contact_resp = db.table("contacts").select("*").eq("id", contact_id).single().execute()
        if not contact_resp.data:
            raise HTTPException(status_code=404, detail="Contact not found")
        
        result = await collect_photo_candidates(contact_resp.data)
        return {"status": "success", "photos": result["candidates"], "dork_links": result["dork_links"]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/override")
async def override_enrichment(req: Request, body: EnrichmentOverrideRequest):
    """REQ-029: PATCH /api/v1/enrichments/override — User manual overrides enriched fields."""
    try:
        apply_user_override(body.entity_id, body.value, "default")
        return {"status": "success", "message": "Override applied"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
