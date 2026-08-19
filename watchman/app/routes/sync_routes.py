from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from typing import List, Optional

from app.core.dependencies import require_super_admin
from app.services import sync_service

router = APIRouter(prefix="/api/sync", tags=["Sync"])


class ConflictDecision(BaseModel):
    collection: str
    id: str
    action: str

    @field_validator("action")
    @classmethod
    def validate_action(cls, value):
        if value not in ("incoming", "local"):
            raise ValueError("action must be 'incoming' or 'local'")
        return value


class ResolveRequest(BaseModel):
    conflicts: List[ConflictDecision] = []
    delete_vs_modify: List[ConflictDecision] = []


@router.get("/status")
async def sync_status(_: dict = Depends(require_super_admin)):
    """Current scan result: counts + pending per-doc changes."""
    return dict(sync_service.pending_status)


@router.post("/run")
async def sync_run(_: dict = Depends(require_super_admin)):
    """Force a scan (same as the non-blocking startup scan)."""
    status = await sync_service.run_sync()
    if not status["atlas_reachable"]:
        raise HTTPException(status_code=503, detail=status.get("last_error") or "Atlas unreachable")
    return status


@router.post("/resolve")
async def sync_resolve(req: ResolveRequest, _: dict = Depends(require_super_admin)):
    """Apply pending changes; unresolved conflicts default to keep-incoming."""
    decisions = [entry.model_dump() for entry in (req.conflicts + req.delete_vs_modify)]
    try:
        result = await sync_service.apply_resolution(decisions)
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return {**result, "pending": sync_service.pending_status["pending"]}