"""
Actions Router — Item 11
CRUD endpoints for Tasks and Projects stored in Supabase.
"""
import logging
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from db.supabase_client import get_supabase

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Helper ───────────────────────────────────────────────────────────────────

def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Pydantic Models ───────────────────────────────────────────────────────────

class TaskCreate(BaseModel):
    id: Optional[str]          = None
    title: str                 = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    status: str                = "pending"
    source: str                = "user"
    priority: str              = "medium"
    due_date: Optional[str]    = None
    project_id: Optional[str]  = None
    contact_id: Optional[str]  = None
    contact_name: Optional[str]= None
    tags: List[str]            = []
    ai_confidence: Optional[float] = None


class TaskPatch(BaseModel):
    title: Optional[str]       = None
    description: Optional[str] = None
    status: Optional[str]      = None
    priority: Optional[str]    = None
    due_date: Optional[str]    = None
    project_id: Optional[str]  = None
    contact_id: Optional[str]  = None
    contact_name: Optional[str]= None
    tags: Optional[List[str]]  = None


class ProjectCreate(BaseModel):
    id: Optional[str]           = None
    title: str                  = Field(..., min_length=1, max_length=300)
    description: Optional[str]  = None
    status: str                 = "active"
    notes: Optional[str]        = None
    tags: List[str]             = []
    start_date: Optional[str]   = None
    end_date: Optional[str]     = None


class ProjectPatch(BaseModel):
    title: Optional[str]        = None
    description: Optional[str]  = None
    status: Optional[str]       = None
    notes: Optional[str]        = None
    tags: Optional[List[str]]   = None
    start_date: Optional[str]   = None
    end_date: Optional[str]     = None


# ── TASKS ─────────────────────────────────────────────────────────────────────

@router.get("/tasks")
async def list_tasks(
    status: Optional[str]     = Query(None),
    project_id: Optional[str] = Query(None),
    contact_id: Optional[str] = Query(None),
    source: Optional[str]     = Query(None),
):
    """List tasks with optional filters."""
    db = get_supabase()
    q  = db.table("tasks").select("*").order("created_at", desc=True)

    if status:     q = q.eq("status", status)
    if project_id: q = q.eq("project_id", project_id)
    if contact_id: q = q.eq("contact_id", contact_id)
    if source:     q = q.eq("source", source)

    try:
        res = q.execute()
        return {"data": res.data or [], "count": len(res.data or [])}
    except Exception as e:
        logger.error(f"[Actions] list_tasks error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tasks", status_code=201)
async def create_task(task: TaskCreate):
    """Create a new task."""
    db = get_supabase()
    payload = task.model_dump(exclude_none=True)
    payload.setdefault("created_at", _utc_now())
    payload.setdefault("updated_at", _utc_now())

    try:
        res = db.table("tasks").insert(payload).execute()
        return {"data": res.data[0], "status": "created"}
    except Exception as e:
        logger.error(f"[Actions] create_task error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tasks/{task_id}")
async def get_task(task_id: str):
    db = get_supabase()
    try:
        res = db.table("tasks").select("*").eq("id", task_id).single().execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Task not found")
        return {"data": res.data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/tasks/{task_id}")
async def update_task(task_id: str, patch: TaskPatch):
    db = get_supabase()
    updates = {k: v for k, v in patch.model_dump().items() if v is not None}
    updates["updated_at"] = _utc_now()

    try:
        res = db.table("tasks").update(updates).eq("id", task_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Task not found")
        return {"data": res.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/tasks/{task_id}", status_code=204)
async def delete_task(task_id: str):
    db = get_supabase()
    try:
        db.table("tasks").delete().eq("id", task_id).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── PROJECTS ──────────────────────────────────────────────────────────────────

@router.get("/projects")
async def list_projects(status: Optional[str] = Query(None)):
    db = get_supabase()
    q  = db.table("projects").select("*").order("created_at", desc=True)
    if status: q = q.eq("status", status)

    try:
        res = q.execute()
        return {"data": res.data or [], "count": len(res.data or [])}
    except Exception as e:
        logger.error(f"[Actions] list_projects error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/projects", status_code=201)
async def create_project(project: ProjectCreate):
    db = get_supabase()
    payload = project.model_dump(exclude_none=True)
    payload.setdefault("created_at", _utc_now())
    payload.setdefault("updated_at", _utc_now())

    try:
        res = db.table("projects").insert(payload).execute()
        return {"data": res.data[0], "status": "created"}
    except Exception as e:
        logger.error(f"[Actions] create_project error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/projects/{project_id}")
async def get_project(project_id: str):
    db = get_supabase()
    try:
        res = db.table("projects").select("*").eq("id", project_id).single().execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Project not found")
        # Fetch associated tasks
        tasks_res = db.table("tasks").select("*").eq("project_id", project_id).execute()
        result = res.data
        result["tasks"] = tasks_res.data or []
        return {"data": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/projects/{project_id}")
async def update_project(project_id: str, patch: ProjectPatch):
    db = get_supabase()
    updates = {k: v for k, v in patch.model_dump().items() if v is not None}
    updates["updated_at"] = _utc_now()

    try:
        res = db.table("projects").update(updates).eq("id", project_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Project not found")
        return {"data": res.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/projects/{project_id}", status_code=204)
async def delete_project(project_id: str):
    db = get_supabase()
    try:
        db.table("projects").delete().eq("id", project_id).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
