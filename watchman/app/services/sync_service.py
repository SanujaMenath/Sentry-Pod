"""
Atlas Source-of-Truth sync engine.

Per-document, Git-style merge between the local vault and Atlas (shared SoT).
Hard rule: if Atlas is unreachable, everything runs locally and sync is skipped.

Merge states:
  incoming        - _id only in Atlas            -> import to vault
  local_only      - _id only in vault            -> push to Atlas
  conflict        - _id in both, content differs -> keep-incoming | keep-local
  conflict-by-key - same unique key, different _id -> keep-incoming | keep-local
  deletion        - deleted in Atlas since manifest -> delete locally (Atlas SoT)
  delete_vs_modify- deleted in Atlas, modified locally -> prompt (default Atlas wins)

The manifest (vault `sync_manifest` collection) records the per-stack snapshot
of synced _id -> hash from the last converged sync, enabling delete detection.
Deletions are only computed for ids present in the previous manifest, so a fresh
stack (no manifest) never deletes anything.

Design notes (see ATLAS_SYNC.md):
- `playbooks` IS synced, deduped by `filename` (conflict-by-key). The YAML files
  themselves live in git; the DB metadata (name, description, tags, scope, status)
  converges across stacks. Machine-local `file_path`, run timestamps, and the
  derived timestamps are excluded from the hash so they never cause churn.
- `canonical_hash` normalizes BSON types (datetime -> UTC ISO, etc.) so naive vs
  tz-aware clients produce identical hashes (no false conflicts).
- `users.recent_activities` is ignored for hashing to avoid churn conflicts.
- The manifest is written only after every apply succeeds; any failure leaves it
  untouched so the next sync re-diffs idempotently.
"""
import asyncio
import hashlib
import logging
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

import bson.json_util as json_util
from bson import DBRef, Binary, Decimal128, ObjectId, regex as bson_regex
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import DuplicateKeyError

from app.core.config import settings
from app.database import db

logger = logging.getLogger(__name__)

DB_NAME = settings.DB_NAME or "sentry_pod_db"

# Local playbooks dir, used to rewrite machine-local file_path on import so the
# vault never inherits another stack's path.
LOCAL_PLAYBOOKS_DIR = str(Path(__file__).parent.parent.parent / "playbooks")

SYNCED_COLLECTIONS = [
    "users",
    "api_keys",
    "audit_logs",
    "devices",
    "notification_preferences",
    "playbooks",
]

# Unique-key fields per collection; used to downgrade push collisions into
# conflict-by-key instead of failing on the target's unique index.
UNIQUE_KEYS = {
    "users": ["username", "email"],
    "notification_preferences": ["username"],
    "devices": ["name"],
    "playbooks": ["filename"],
    "api_keys": [],
    "audit_logs": [],
}

# Top-level fields ignored when hashing (avoid churn-caused false conflicts).
HASH_IGNORE = {
    "users": {"recent_activities"},
    # playbooks: file_path is machine-local; run/derived timestamps churn.
    "playbooks": {"file_path", "last_executed", "timestamp_created", "last_modified"},
}

# Default resolution when the user does not explicitly pick for a conflict.
RESOLUTION_DEFAULTS = {
    "users": "incoming",
    "notification_preferences": "incoming",
    "devices": "incoming",
    "api_keys": "incoming",
    "audit_logs": "incoming",
    "playbooks": "incoming",
}

AUDIT_SYNC_WINDOW_DAYS = int(os.getenv("AUDIT_SYNC_WINDOW_DAYS", "30"))

_sync_running = False

pending_status = {
    "atlas_reachable": False,
    "last_sync": None,
    "last_error": None,
    "in_progress": False,
    "collections": {},
    "pending": {
        "incoming": [],
        "local_only": [],
        "conflicts": [],
        "deletions": [],
        "delete_vs_modify": [],
    },
}


# ---------------------------------------------------------------------------
# Hashing / normalization (pure)
# ---------------------------------------------------------------------------
def _normalize(value):
    """Recursively convert BSON types to JSON-safe, tz-independent values."""
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).isoformat()
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, Decimal128):
        return str(value)
    if isinstance(value, bytes):
        return ("binary", value.hex())
    if isinstance(value, bson_regex.Regex):
        return ("regex", value.pattern, value.flags)
    if isinstance(value, DBRef):
        return {"$ref": value.collection, "$id": _normalize(value.id)}
    if isinstance(value, dict):
        return {k: _normalize(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_normalize(v) for v in value]
    return value


def canonical_hash(doc, ignore=None):
    """Deterministic content hash for a document (excludes _id and ignored fields)."""
    cleaned = dict(doc)
    cleaned.pop("_id", None)
    if ignore:
        for field in ignore:
            cleaned.pop(field, None)
    normalized = _normalize(cleaned)
    payload = json_util.dumps(normalized, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def compute_diff(atlas_hashes, vault_hashes, manifest_hashes):
    """Pure three-way diff. Inputs are {_id_str: hash} maps; output is sets of id strings.

    Deletions are only reported for ids present in the previous manifest, so a
    fresh stack (empty manifest) never treats vault docs as deleted.
    """
    incoming = set()
    local_only = set()
    conflicts = set()
    unchanged = set()
    deletions = set()
    delete_vs_modify = set()

    all_ids = set(atlas_hashes) | set(vault_hashes)
    for doc_id in all_ids:
        in_atlas = doc_id in atlas_hashes
        in_vault = doc_id in vault_hashes
        if in_atlas and in_vault:
            if atlas_hashes[doc_id] == vault_hashes[doc_id]:
                unchanged.add(doc_id)
            else:
                conflicts.add(doc_id)
        elif in_atlas:
            incoming.add(doc_id)
        else:
            manifest_hash = manifest_hashes.get(doc_id)
            if manifest_hash is None:
                local_only.add(doc_id)
            elif manifest_hash == vault_hashes[doc_id]:
                deletions.add(doc_id)
            else:
                delete_vs_modify.add(doc_id)

    return {
        "incoming": incoming,
        "local_only": local_only,
        "conflicts": conflicts,
        "unchanged": unchanged,
        "deletions": deletions,
        "delete_vs_modify": delete_vs_modify,
    }


# ---------------------------------------------------------------------------
# Atlas client / scan
# ---------------------------------------------------------------------------
def atlas_uri():
    return os.getenv("ATLAS_URI") or (settings.ATLAS_URI or None)


def _atlas_client():
    uri = atlas_uri()
    if not uri:
        raise ValueError("ATLAS_URI not configured")
    return AsyncIOMotorClient(
        uri,
        tz_aware=True,
        serverSelectionTimeoutMS=5000,
        connectTimeoutMS=5000,
        socketTimeoutMS=30000,
    )


def _window_filter(collection_name):
    """Cap audit_logs sync to the configured lookback window."""
    if collection_name == "audit_logs":
        cutoff = (datetime.now(timezone.utc) - timedelta(days=AUDIT_SYNC_WINDOW_DAYS)).strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        )
        return {"timestamp": {"$gte": cutoff}}
    return {}


class _CollectionState:
    def __init__(self, name):
        self.name = name
        self.atlas_hashes = {}
        self.vault_hashes = {}
        self.atlas_docs = {}
        self.vault_docs = {}
        self.manifest_hashes = {}
        self.diff = None
        # maps atlas _id (str) -> colliding vault _id (str) for conflict-by-key
        self.by_key = {}


async def _read_manifest(vault_db):
    doc = await vault_db.get_collection("sync_manifest").find_one({"_id": "sync_manifest"})
    return (doc or {}).get("collections", {})


async def _write_manifest(vault_db, states):
    collections = {}
    for name, state in states.items():
        collections[name] = dict(state.atlas_hashes)
    await vault_db.get_collection("sync_manifest").replace_one(
        {"_id": "sync_manifest"},
        {"collections": collections, "updated_at": datetime.now(timezone.utc).isoformat()},
        upsert=True,
    )


async def _find_collision(atlas_col, doc, unique_fields):
    if not unique_fields:
        return None
    or_clauses = [{field: doc[field]} for field in unique_fields if doc.get(field) is not None]
    if not or_clauses:
        return None
    query = {"$or": or_clauses, "_id": {"$ne": doc.get("_id")}}
    return await atlas_col.find_one(query)


async def _scan():
    """Connect to Atlas, scan every synced collection, and classify each doc.

    Returns a dict: {client, db, states, manifest}. Raises if Atlas is
    unreachable or ATLAS_URI is unset (callers handle it).
    """
    client = _atlas_client()
    await client.admin.command("ping")
    atlas_db = client[DB_NAME]
    vault_db = db
    manifest = await _read_manifest(vault_db)
    states = {}

    for name in SYNCED_COLLECTIONS:
        state = _CollectionState(name)
        atlas_col = atlas_db.get_collection(name)
        vault_col = vault_db.get_collection(name)
        ignore = HASH_IGNORE.get(name)
        window = _window_filter(name)

        async for doc in atlas_col.find(window):
            sid = str(doc["_id"])
            state.atlas_hashes[sid] = canonical_hash(doc, ignore)
            state.atlas_docs[sid] = doc

        async for doc in vault_col.find(window):
            sid = str(doc["_id"])
            state.vault_hashes[sid] = canonical_hash(doc, ignore)
            state.vault_docs[sid] = doc

        state.manifest_hashes = manifest.get(name, {})
        state.diff = compute_diff(
            state.atlas_hashes, state.vault_hashes, state.manifest_hashes
        )
        states[name] = state

    # Downgrade push collisions into conflict-by-key (needs the live Atlas client).
    for state in states.values():
        unique_fields = UNIQUE_KEYS.get(state.name) or []
        if not unique_fields:
            continue
        for sid_local in list(state.diff["local_only"]):
            doc = state.vault_docs[sid_local]
            collision = await _find_collision(atlas_db.get_collection(state.name), doc, unique_fields)
            if collision is not None:
                sid_atlas = str(collision["_id"])
                state.by_key[sid_atlas] = sid_local
                state.diff["local_only"].discard(sid_local)
                state.diff["conflicts"].add(sid_atlas)
                if sid_atlas not in state.atlas_docs:
                    state.atlas_docs[sid_atlas] = collision
                    state.atlas_hashes[sid_atlas] = canonical_hash(
                        collision, HASH_IGNORE.get(state.name)
                    )

    return {"client": client, "db": atlas_db, "states": states, "manifest": manifest}


# ---------------------------------------------------------------------------
# Status serialization
# ---------------------------------------------------------------------------
def _summarize(doc, max_len=500, max_list=10):
    if not isinstance(doc, dict):
        return {}
    out = {}
    for key, value in doc.items():
        if key in ("_id", "password"):
            continue
        if isinstance(value, str) and len(value) > max_len:
            value = value[:max_len] + "..."
        elif isinstance(value, (list, tuple)) and len(value) > max_list:
            value = list(value[:max_list])
        out[key] = _normalize(value)
    return out


def _to_status(states):
    pending = {
        "incoming": [],
        "local_only": [],
        "conflicts": [],
        "deletions": [],
        "delete_vs_modify": [],
    }
    collections = {}
    for name, state in states.items():
        collections[name] = {
            "incoming": len(state.diff["incoming"]),
            "local_only": len(state.diff["local_only"]),
            "conflicts": len(state.diff["conflicts"]),
            "deletions": len(state.diff["deletions"]),
            "delete_vs_modify": len(state.diff["delete_vs_modify"]),
            "unchanged": len(state.diff["unchanged"]),
        }
        for sid in sorted(state.diff["incoming"]):
            pending["incoming"].append(
                {"collection": name, "id": sid, "summary": _summarize(state.atlas_docs[sid])}
            )
        for sid in sorted(state.diff["local_only"]):
            pending["local_only"].append(
                {"collection": name, "id": sid, "summary": _summarize(state.vault_docs[sid])}
            )
        for sid in sorted(state.diff["conflicts"]):
            vault_sid = state.by_key.get(sid, sid)
            entry = {
                "collection": name,
                "id": sid,
                "atlas": _summarize(state.atlas_docs[sid]),
                "vault": _summarize(state.vault_docs[vault_sid]),
            }
            if sid in state.by_key:
                entry["by_key"] = True
                entry["key_id"] = state.by_key[sid]
            pending["conflicts"].append(entry)
        for sid in sorted(state.diff["deletions"]):
            pending["deletions"].append({"collection": name, "id": sid})
        for sid in sorted(state.diff["delete_vs_modify"]):
            pending["delete_vs_modify"].append(
                {"collection": name, "id": sid, "vault": _summarize(state.vault_docs[sid])}
            )
    return {"atlas_reachable": True, "collections": collections, "pending": pending}


# ---------------------------------------------------------------------------
# Apply / resolve
# ---------------------------------------------------------------------------
def _decision(decisions, name, sid, default):
    for entry in decisions or []:
        if entry.get("collection") == name and entry.get("id") == sid:
            return entry.get("action") or default
    return default


async def _upsert(col, doc):
    await col.replace_one({"_id": doc["_id"]}, dict(doc), upsert=True)


async def _delete(col, doc_id):
    await col.delete_one({"_id": doc_id})


async def _apply_collection(state, decisions, atlas_db, vault_db):
    name = state.name
    atlas_col = atlas_db.get_collection(name)
    vault_col = vault_db.get_collection(name)
    ignore = HASH_IGNORE.get(name)
    default = RESOLUTION_DEFAULTS.get(name, "incoming")
    applied = 0

    def localize(doc):
        """Rewrite machine-local fields for playbooks before writing to vault."""
        if name == "playbooks" and doc.get("filename"):
            doc = dict(doc)
            doc["file_path"] = str(Path(LOCAL_PLAYBOOKS_DIR) / doc["filename"])
        return doc

    for sid in sorted(state.diff["incoming"]):
        doc = localize(state.atlas_docs[sid])
        await _upsert(vault_col, doc)
        state.vault_docs[sid] = doc
        state.vault_hashes[sid] = canonical_hash(doc, ignore)
        applied += 1

    for sid in sorted(state.diff["local_only"]):
        doc = state.vault_docs[sid]
        try:
            await _upsert(atlas_col, doc)
        except DuplicateKeyError:
            logger.warning("Push collision on %s/%s; left pending", name, sid)
            continue
        state.atlas_docs[sid] = doc
        state.atlas_hashes[sid] = canonical_hash(doc, ignore)
        applied += 1

    for sid in sorted(state.diff["conflicts"]):
        action = _decision(decisions, name, sid, default)
        if sid in state.by_key:
            vault_id = state.by_key[sid]
            vault_doc = state.vault_docs[vault_id]
            atlas_doc = state.atlas_docs[sid]
            if action == "local":
                await _delete(atlas_col, atlas_doc["_id"])
                await _upsert(atlas_col, vault_doc)
                state.atlas_docs[sid] = vault_doc
                state.atlas_hashes[sid] = canonical_hash(vault_doc, ignore)
            else:
                await _delete(vault_col, vault_doc["_id"])
                atlas_doc = localize(atlas_doc)
                await _upsert(vault_col, atlas_doc)
                state.vault_docs.pop(vault_id, None)
                state.vault_hashes.pop(vault_id, None)
                state.vault_docs[sid] = atlas_doc
                state.vault_hashes[sid] = canonical_hash(atlas_doc, ignore)
            state.by_key.pop(sid, None)
        else:
            atlas_doc = state.atlas_docs[sid]
            vault_doc = state.vault_docs[sid]
            if action == "local":
                await _upsert(atlas_col, vault_doc)
                state.atlas_docs[sid] = vault_doc
                state.atlas_hashes[sid] = canonical_hash(vault_doc, ignore)
            else:
                atlas_doc = localize(atlas_doc)
                await _upsert(vault_col, atlas_doc)
                state.vault_docs[sid] = atlas_doc
                state.vault_hashes[sid] = canonical_hash(atlas_doc, ignore)
        applied += 1

    for sid in sorted(state.diff["deletions"]):
        await _delete(vault_col, state.vault_docs[sid]["_id"])
        state.vault_docs.pop(sid, None)
        state.vault_hashes.pop(sid, None)
        applied += 1

    for sid in sorted(state.diff["delete_vs_modify"]):
        action = _decision(decisions, name, sid, default)
        if action == "local":
            doc = state.vault_docs[sid]
            await _upsert(atlas_col, doc)
            state.atlas_docs[sid] = doc
            state.atlas_hashes[sid] = canonical_hash(doc, ignore)
        else:
            await _delete(vault_col, state.vault_docs[sid]["_id"])
            state.vault_docs.pop(sid, None)
            state.vault_hashes.pop(sid, None)
        applied += 1

    return applied


# ---------------------------------------------------------------------------
# Public entry points
# ---------------------------------------------------------------------------
async def run_sync():
    """Scan and stash pending status. Never raises; sets last_error on failure."""
    global _sync_running, pending_status
    if _sync_running:
        return dict(pending_status)
    _sync_running = True
    pending_status["in_progress"] = True
    try:
        scan = await _scan()
        try:
            pending_status = _to_status(scan["states"])
            pending_status["last_sync"] = datetime.now(timezone.utc).isoformat()
            pending_status["last_error"] = None
        finally:
            scan["client"].close()
    except Exception as exc:
        logger.warning("Atlas sync scan failed: %s", exc)
        pending_status["atlas_reachable"] = False
        pending_status["last_error"] = str(exc)
    finally:
        _sync_running = False
        pending_status["in_progress"] = False
    return dict(pending_status)


async def apply_resolution(decisions):
    """Apply pending changes (defaults: keep-incoming) and converge the manifest."""
    global _sync_running, pending_status
    if _sync_running:
        raise RuntimeError("A sync is already in progress")
    _sync_running = True
    pending_status["in_progress"] = True
    try:
        try:
            scan = await _scan()
        except Exception as exc:
            raise RuntimeError(f"Could not reach Atlas: {exc}") from exc
        states = scan["states"]
        atlas_db = scan["db"]
        vault_db = db
        results = {"applied": 0}
        try:
            for name in SYNCED_COLLECTIONS:
                results["applied"] += await _apply_collection(
                    states[name], decisions, atlas_db, vault_db
                )
            await _write_manifest(vault_db, states)
        finally:
            scan["client"].close()
        pending_status = _to_status(states)
        pending_status["last_sync"] = datetime.now(timezone.utc).isoformat()
        pending_status["last_error"] = None
    finally:
        _sync_running = False
        pending_status["in_progress"] = False
    return results


async def check_atlas_reachable():
    try:
        client = _atlas_client()
        try:
            await client.admin.command("ping")
            return True
        finally:
            client.close()
    except Exception:
        return False


def sync_in_progress():
    return _sync_running