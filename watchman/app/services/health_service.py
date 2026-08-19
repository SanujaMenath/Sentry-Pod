"""Health checks. The vault ping uses a dedicated short-lived client with a
small server-selection timeout so it never blocks on the app's global client
(which defaults to 30s)."""
import os
import time

from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import settings

_negative_cache_until = 0.0
_last_result = True


async def vault_ping() -> bool:
    """Return True if the local vault is reachable. Negative results are cached ~5s."""
    global _negative_cache_until, _last_result
    if not _last_result and time.monotonic() < _negative_cache_until:
        return False

    uri = os.getenv("MONGO_URI") or settings.MONGO_URI
    client = AsyncIOMotorClient(
        uri,
        tz_aware=True,
        serverSelectionTimeoutMS=2000,
        connectTimeoutMS=2000,
    )
    try:
        await client.admin.command("ping")
        _last_result = True
        return True
    except Exception:
        _last_result = False
        _negative_cache_until = time.monotonic() + 5.0
        return False
    finally:
        client.close()


async def atlas_reachable() -> bool:
    from app.services.sync_service import check_atlas_reachable

    return await check_atlas_reachable()