"""Pure-Python backup/restore for the local vault (no mongodump dependency).

Dumps each collection to a JSON file under `watchman/backups/<ts>/`. BSON types
are preserved via bson.json_util. Restore refuses to run while a sync is active
(and vice-versa) to avoid interleaving writes.
"""
import logging
import re
from datetime import datetime, timezone
from pathlib import Path

import bson.json_util as json_util

from app.database import db
from app.services import sync_service

logger = logging.getLogger(__name__)

BACKUP_DIR = Path(__file__).parent.parent.parent / "backups"

TS_RE = re.compile(r"^\d{8}-\d{6}$")

EXCLUDED_COLLECTIONS = {"system.views"}


def _ts() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")


async def create_backup() -> dict:
    if sync_service.sync_in_progress():
        raise RuntimeError("Cannot create a backup while a sync is in progress")

    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    backup_dir = BACKUP_DIR / _ts()
    backup_dir.mkdir(parents=True, exist_ok=True)

    counts = {}
    for name in sorted(await db.list_collection_names()):
        if name in EXCLUDED_COLLECTIONS:
            continue
        docs = await db.get_collection(name).find().to_list(length=None)
        (backup_dir / f"{name}.json").write_text(
            json_util.dumps(docs, indent=2), encoding="utf-8"
        )
        counts[name] = len(docs)

    meta = {"created_at": datetime.now(timezone.utc).isoformat(), "collections": counts}
    (backup_dir / "meta.json").write_text(
        json_util.dumps(meta, indent=2), encoding="utf-8"
    )
    logger.info("Backup written to %s (%d collections)", backup_dir.name, len(counts))
    return {"path": backup_dir.name, "collections": counts}


def list_backups() -> list:
    if not BACKUP_DIR.exists():
        return []
    out = []
    for entry in sorted(BACKUP_DIR.iterdir(), reverse=True):
        if not entry.is_dir() or not TS_RE.match(entry.name):
            continue
        meta_path = entry / "meta.json"
        collections = {}
        created_at = None
        if meta_path.exists():
            try:
                meta = json_util.loads(meta_path.read_text(encoding="utf-8"))
                collections = meta.get("collections", {})
                created_at = meta.get("created_at")
            except Exception as exc:
                logger.warning("Could not read meta for %s: %s", entry.name, exc)
        out.append({"path": entry.name, "created_at": created_at, "collections": collections})
    return out


async def restore_backup(name: str) -> dict:
    if not TS_RE.match(name or ""):
        raise ValueError("Invalid backup name")
    if sync_service.sync_in_progress():
        raise RuntimeError("Cannot restore while a sync is in progress")

    backup_dir = BACKUP_DIR / name
    if not backup_dir.is_dir():
        raise FileNotFoundError(f"Backup '{name}' not found")

    restored = {}
    for json_file in sorted(backup_dir.glob("*.json")):
        if json_file.name == "meta.json":
            continue
        col_name = json_file.stem
        docs = json_util.loads(json_file.read_text(encoding="utf-8"))
        col = db.get_collection(col_name)
        await col.delete_many({})
        if docs:
            await col.insert_many(docs, ordered=False)
        restored[col_name] = len(docs)

    logger.info("Restored backup %s (%d collections)", name, len(restored))
    return {"path": name, "restored": restored}