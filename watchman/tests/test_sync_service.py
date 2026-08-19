"""
Unit tests for the Atlas sync engine (pure functions — no DB required).

Run from watchman/:  python -m pytest tests/
"""
import asyncio
from datetime import datetime, timedelta, timezone

import pytest

from app.services.sync_service import (
    SYNCED_COLLECTIONS,
    compute_diff,
    canonical_hash,
)


# ---------------------------------------------------------------------------
# canonical_hash
# ---------------------------------------------------------------------------
def test_hash_excludes_id_and_is_stable():
    a = {"_id": "abc", "username": "alice", "role": "admin"}
    b = {"_id": "def", "username": "alice", "role": "admin"}
    assert canonical_hash(a) == canonical_hash(b)


def test_hash_ignores_specified_fields():
    a = {"username": "alice", "recent_activities": [{"event": "x"}]}
    b = {"username": "alice", "recent_activities": [{"event": "y"}]}
    assert canonical_hash(a, ignore={"recent_activities"}) == canonical_hash(
        b, ignore={"recent_activities"}
    )


def test_hash_differs_on_content():
    a = {"username": "alice", "role": "admin"}
    b = {"username": "alice", "role": "user"}
    assert canonical_hash(a) != canonical_hash(b)


def test_hash_naive_and_aware_datetimes_agree():
    aware = {"ts": datetime(2026, 8, 14, 19, 0, 0, tzinfo=timezone.utc)}
    naive = {"ts": datetime(2026, 8, 14, 19, 0, 0)}
    assert canonical_hash(aware) == canonical_hash(naive)


def test_hash_timezone_shifts_agree():
    shifted = {"ts": datetime(2026, 8, 15, 2, 0, 0, tzinfo=timezone(timedelta(hours=7)))}
    utc = {"ts": datetime(2026, 8, 14, 19, 0, 0, tzinfo=timezone.utc)}
    assert canonical_hash(shifted) == canonical_hash(utc)


def test_hash_objectid_key_order_insensitive():
    from bson import ObjectId

    a = {"username": "bob", "meta": {"role": "admin", "active": True}}
    b = {"username": "bob", "meta": {"active": True, "role": "admin"}}
    assert canonical_hash(a) == canonical_hash(b)
    assert isinstance(canonical_hash({"oid": ObjectId()}), str)


def test_hash_is_json_safe_for_bson_types():
    from bson import Decimal128

    doc = {"price": Decimal128("12.50"), "tags": ["a", "b"]}
    h = canonical_hash(doc)
    assert isinstance(h, str) and len(h) == 64


# ---------------------------------------------------------------------------
# compute_diff
# ---------------------------------------------------------------------------
def test_diff_empty():
    d = compute_diff({}, {}, {})
    assert d["incoming"] == set()
    assert d["local_only"] == set()
    assert d["conflicts"] == set()
    assert d["deletions"] == set()
    assert d["delete_vs_modify"] == set()


def test_diff_incoming_and_local_only():
    atlas = {"a": "h1"}
    vault = {"b": "h2"}
    d = compute_diff(atlas, vault, {})
    assert d["incoming"] == {"a"}
    assert d["local_only"] == {"b"}


def test_diff_conflict_and_unchanged():
    atlas = {"x": "hA", "same": "hS"}
    vault = {"x": "hB", "same": "hS"}
    d = compute_diff(atlas, vault, {})
    assert d["conflicts"] == {"x"}
    assert d["unchanged"] == {"same"}


def test_diff_delete_detected_via_manifest():
    # doc "gone" was converged (in manifest), then removed from Atlas -> delete
    atlas = {}
    vault = {"gone": "h1"}
    manifest = {"gone": "h1"}
    d = compute_diff(atlas, vault, manifest)
    assert d["deletions"] == {"gone"}
    assert d["local_only"] == set()


def test_diff_fresh_stack_no_deletions():
    # empty manifest -> vault-only docs are local_only, never deletions
    atlas = {}
    vault = {"a": "h1", "b": "h2"}
    d = compute_diff(atlas, vault, {})
    assert d["deletions"] == set()
    assert d["local_only"] == {"a", "b"}


def test_diff_delete_vs_modify():
    # doc was converged (manifest hash h1) but vault now differs -> prompt
    atlas = {}
    vault = {"changed": "h2"}
    manifest = {"changed": "h1"}
    d = compute_diff(atlas, vault, manifest)
    assert d["delete_vs_modify"] == {"changed"}
    assert d["deletions"] == set()


def test_diff_deleted_everywhere_ignored():
    atlas = {}
    vault = {}
    manifest = {"gone": "h1"}
    d = compute_diff(atlas, vault, manifest)
    assert d["deletions"] == set()


def test_diff_manifest_unchanged_doc_still_unchanged():
    atlas = {"x": "hS"}
    vault = {"x": "hS"}
    manifest = {"x": "hS"}
    d = compute_diff(atlas, vault, manifest)
    assert d["unchanged"] == {"x"}
    assert d["conflicts"] == set()


def test_diff_conflict_when_manifest_matches_vault_but_atlas_changed():
    # Atlas changed since manifest -> conflict (both-side content differs)
    atlas = {"x": "hNew"}
    vault = {"x": "hOld"}
    manifest = {"x": "hOld"}
    d = compute_diff(atlas, vault, manifest)
    assert d["conflicts"] == {"x"}


# ---------------------------------------------------------------------------
# Sync set / config sanity
# ---------------------------------------------------------------------------
def test_playbooks_included_in_sync():
    assert "playbooks" in SYNCED_COLLECTIONS


def test_playbooks_deduped_by_filename():
    from app.services.sync_service import UNIQUE_KEYS

    assert "filename" in UNIQUE_KEYS["playbooks"]


def test_synced_collections_are_stable():
    assert SYNCED_COLLECTIONS == [
        "users",
        "api_keys",
        "audit_logs",
        "devices",
        "notification_preferences",
        "playbooks",
    ]


# ---------------------------------------------------------------------------
# Resolution defaults
# ---------------------------------------------------------------------------
def test_resolution_defaults_exist_for_every_synced_collection():
    from app.services.sync_service import RESOLUTION_DEFAULTS

    for collection in SYNCED_COLLECTIONS:
        assert RESOLUTION_DEFAULTS[collection] in ("incoming", "local")


# ---------------------------------------------------------------------------
# Async orchestration pieces that need no DB
# ---------------------------------------------------------------------------
def test_decision_lookup():
    from app.services.sync_service import _decision

    decisions = [{"collection": "users", "id": "abc", "action": "local"}]
    assert _decision(decisions, "users", "abc", "incoming") == "local"
    assert _decision(decisions, "users", "zzz", "incoming") == "incoming"
    assert _decision([], "users", "abc", "incoming") == "incoming"
    assert _decision(decisions, "devices", "abc", "incoming") == "incoming"


def test_summarize_drops_secrets():
    from app.services.sync_service import _summarize

    out = _summarize({"_id": "x", "password": "hash", "username": "alice"})
    assert "password" not in out
    assert "username" in out
    assert "_id" not in out


def test_window_filter_caps_audit_logs():
    from app.services.sync_service import _window_filter

    assert _window_filter("devices") == {}
    audit_filter = _window_filter("audit_logs")
    assert "timestamp" in audit_filter
    assert "$gte" in audit_filter["timestamp"]


def test_atlas_uri_unset_raises_from_client(monkeypatch):
    import os

    from app.core.config import settings
    from app.services.sync_service import _atlas_client, atlas_uri

    monkeypatch.delenv("ATLAS_URI", raising=False)
    monkeypatch.setattr(settings, "ATLAS_URI", None)
    assert atlas_uri() is None
    with pytest.raises(ValueError):
        _atlas_client()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])