from bson import ObjectId
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.dependencies import get_current_user
from app.database import db

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

DEFAULT_PREFERENCES = {
    "enabled": True,
    "sound_enabled": True,
    "topology_refresh": True,
    "syslog_alerts": True,
    "playbook_updates": True,
    "critical_only": False,
}


class NotificationPreferences(BaseModel):
    enabled: bool = True
    sound_enabled: bool = True
    topology_refresh: bool = True
    syslog_alerts: bool = True
    playbook_updates: bool = True
    critical_only: bool = False


async def _preferences_for(username: str) -> dict:
    stored = await db.get_collection("notification_preferences").find_one({"username": username})
    return {**DEFAULT_PREFERENCES, **(stored or {})}


def _is_enabled(notification: dict, preferences: dict) -> bool:
    if not preferences["enabled"]:
        return False
    if preferences["critical_only"] and notification.get("severity") != "critical":
        return False
    category = notification.get("category")
    return not (
        (category == "topology" and not preferences["topology_refresh"])
        or (category == "syslog" and not preferences["syslog_alerts"])
        or (category == "completion" and not preferences["playbook_updates"])
    )


def _serialize(notification: dict, username: str) -> dict:
    return {
        "id": str(notification["_id"]),
        "title": notification["title"],
        "message": notification["message"],
        "category": notification.get("category", "system"),
        "severity": notification.get("severity", "info"),
        "link": notification.get("link"),
        "created_at": notification["created_at"],
        "read": username in notification.get("read_by", []),
    }


@router.get("")
async def list_notifications(
    limit: int = 50, current_user: dict = Depends(get_current_user)
):
    limit = max(1, min(limit, 100))
    username = current_user["username"]
    preferences = await _preferences_for(username)
    notifications = await (
        db.get_collection("notifications")
        .find({"dismissed_by": {"$ne": username}})
        .sort("created_at", -1)
        .limit(limit)
        .to_list(length=limit)
    )
    items = [_serialize(item, username) for item in notifications if _is_enabled(item, preferences)]
    return {
        "items": items,
        "unread_count": sum(not item["read"] for item in items),
        "preferences": {key: preferences[key] for key in DEFAULT_PREFERENCES},
    }


@router.get("/preferences")
async def get_preferences(current_user: dict = Depends(get_current_user)):
    preferences = await _preferences_for(current_user["username"])
    return {key: preferences[key] for key in DEFAULT_PREFERENCES}


@router.put("/preferences")
async def update_preferences(
    preferences: NotificationPreferences, current_user: dict = Depends(get_current_user)
):
    values = preferences.model_dump()
    await db.get_collection("notification_preferences").update_one(
        {"username": current_user["username"]},
        {"$set": values, "$setOnInsert": {"username": current_user["username"]}},
        upsert=True,
    )
    return values


@router.post("/{notification_id}/read")
async def mark_notification_read(
    notification_id: str, current_user: dict = Depends(get_current_user)
):
    try:
        object_id = ObjectId(notification_id)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found") from exc

    result = await db.get_collection("notifications").update_one(
        {"_id": object_id}, {"$addToSet": {"read_by": current_user["username"]}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    return {"status": "success"}


@router.post("/read-all")
async def mark_all_notifications_read(current_user: dict = Depends(get_current_user)):
    await db.get_collection("notifications").update_many(
        {"read_by": {"$ne": current_user["username"]}},
        {"$addToSet": {"read_by": current_user["username"]}},
    )
    return {"status": "success"}


@router.post("/clear")
async def clear_notifications(current_user: dict = Depends(get_current_user)):
    """Hide all current notifications for this user without deleting global events."""
    result = await db.get_collection("notifications").update_many(
        {"dismissed_by": {"$ne": current_user["username"]}},
        {"$addToSet": {"dismissed_by": current_user["username"]}},
    )
    return {"status": "success", "cleared_count": result.modified_count}
