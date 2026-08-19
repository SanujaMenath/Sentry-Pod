from fastapi import APIRouter, Depends, HTTPException

from app.core.dependencies import require_super_admin
from app.services import backup_service

router = APIRouter(prefix="/api/backups", tags=["Backups"])


@router.get("")
async def list_backups(_: dict = Depends(require_super_admin)):
    return {"backups": backup_service.list_backups()}


@router.post("")
async def create_backup(_: dict = Depends(require_super_admin)):
    try:
        return await backup_service.create_backup()
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc))


@router.post("/restore/{name}")
async def restore_backup(name: str, _: dict = Depends(require_super_admin)):
    try:
        return await backup_service.restore_backup(name)
    except (ValueError, FileNotFoundError) as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc))