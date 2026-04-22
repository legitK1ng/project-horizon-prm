"""
Contacts Router — AGENT-3a | REQ-016, REQ-036
Handles full CRUD for the relational contacts model.
Calculates Relationship Health Score on-demand (REQ-036).
Supports paginated contact loading for large datasets (1800+ contacts).
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Request, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional

from services.health_service import calculate_health_score, update_contact_health

router = APIRouter()

class ContactCreate(BaseModel):
    first_name: str
    last_name: Optional[str] = None
    birthdate: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    organization: Optional[str] = None
    organization_id: Optional[str] = None
    notes: Optional[str] = None
    photo_url: Optional[str] = None
    tags: List[str] = []

class ContactUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    birthdate: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    organization: Optional[str] = None
    organization_id: Optional[str] = None
    notes: Optional[str] = None
    photo_url: Optional[str] = None
    tags: List[str] = None
    health_score: Optional[float] = None
    is_favorite: Optional[bool] = None

@router.get("/")
@router.get("")
async def list_contacts(
    req: Request,
    page: int = Query(default=0, ge=0),
    limit: int = Query(default=500, ge=1, le=1000),
    search: Optional[str] = Query(default=None),
    favorites_only: bool = Query(default=False),
):
    """
    REQ-016: GET /api/v1/contacts — Paginated contact list.
    Supports cursor pagination via page/limit to handle 1800+ contacts.
    """
    db = getattr(req.app.state, "supabase", None)
    if not db:
        raise HTTPException(status_code=503, detail="Database not available")

    try:
        query = db.table("contacts").select("*", count="exact")

        # Apply filters
        if favorites_only:
            query = query.eq("is_favorite", True)
        if search:
            # Strip PostgREST filter metacharacters (comma = clause separator, parens = grouping)
            safe = search.replace(",", " ").replace("(", "").replace(")", "").strip()
            query = query.or_(
                f"first_name.ilike.%{safe}%,"
                f"last_name.ilike.%{safe}%,"
                f"organization.ilike.%{safe}%,"
                f"phone.ilike.%{safe}%,"
                f"email.ilike.%{safe}%"
            )

        start = page * limit
        end = start + limit - 1
        response = query.order("first_name").range(start, end).execute()

        total_count = response.count if hasattr(response, 'count') and response.count is not None else len(response.data)

        return {
            "status": "success",
            "data": response.data,
            "count": len(response.data),
            "total_count": total_count,
            "page": page,
            "limit": limit,
            "has_more": (start + len(response.data)) < total_count,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{contact_id}")
async def get_contact(req: Request, contact_id: str):
    db = getattr(req.app.state, "supabase", None)
    if not db:
        raise HTTPException(status_code=503, detail="Database not available")

    try:
        response = db.table("contacts").select("*").eq("id", contact_id).single().execute()
        contact = response.data

        # REQ-036: Compute Health Score on the fly
        contact["health_score"] = calculate_health_score(contact_id)

        return contact
    except Exception as e:
        err = str(e)
        if "PGRST116" in err or "JSON object requested, multiple (or no) rows returned" in err:
            raise HTTPException(status_code=404, detail="Contact not found")
        raise HTTPException(status_code=500, detail=err)


@router.post("/{contact_id}/refresh-health")
async def refresh_contact_health(req: Request, contact_id: str):
    """REQ-017: Explicitly triggers a health score recalculation and persists it to the DB."""
    db = getattr(req.app.state, "supabase", None)
    if not db:
        raise HTTPException(status_code=503, detail="Database not available")

    try:
        update_contact_health(contact_id)
        return {"status": "success", "message": f"Health score refreshed for contact {contact_id}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{contact_id}/favorite")
async def toggle_favorite(req: Request, contact_id: str):
    """Toggle contact favorite status — favorites get health score display."""
    db = getattr(req.app.state, "supabase", None)
    if not db:
        raise HTTPException(status_code=503, detail="Database not available")

    try:
        current = db.table("contacts").select("is_favorite").eq("id", contact_id).single().execute()
        current_fav = current.data.get("is_favorite", False) if current.data else False
        response = db.table("contacts").update({
            "is_favorite": not current_fav,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", contact_id).execute()
        return {"status": "success", "is_favorite": not current_fav}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{contact_id}/photo")
async def set_contact_photo(req: Request, contact_id: str, body: dict):
    """Set the primary photo_url for a contact (from OSINT candidates)."""
    db = getattr(req.app.state, "supabase", None)
    if not db:
        raise HTTPException(status_code=503, detail="Database not available")

    photo_url = body.get("photo_url")
    if not photo_url:
        raise HTTPException(status_code=400, detail="photo_url is required")

    try:
        response = db.table("contacts").update({
            "photo_url": photo_url,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", contact_id).execute()
        return {"status": "success", "photo_url": photo_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/")
@router.post("")
async def create_contact(req: Request, body: ContactCreate):
    db = getattr(req.app.state, "supabase", None)
    if not db:
        raise HTTPException(status_code=503, detail="Database not available")

    record = body.dict()

    # Resolve real user_id from profiles (single-user system — one profile row)
    try:
        profile = db.table("profiles").select("id").limit(1).execute()
        if not profile.data:
            raise HTTPException(status_code=500, detail="No user profile found; cannot create contact")
        record["user_id"] = profile.data[0]["id"]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Profile lookup failed: {str(e)}")

    try:
        response = db.table("contacts").insert(record).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{contact_id}")
async def update_contact(req: Request, contact_id: str, body: ContactUpdate):
    db = getattr(req.app.state, "supabase", None)
    if not db:
        raise HTTPException(status_code=503, detail="Database not available")

    updates = {k: v for k, v in body.dict().items() if v is not None}
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    try:
        response = db.table("contacts").update(updates).eq("id", contact_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Contact not found for update")
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
