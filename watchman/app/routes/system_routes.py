from fastapi import APIRouter

from app.services.health_service import atlas_reachable, vault_ping

router = APIRouter(prefix="/api/system", tags=["System"])


@router.get("/health")
async def system_health():
    return {
        "status": "ok",
        "vault": await vault_ping(),
        "atlas": await atlas_reachable(),
    }