from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.dependencies import get_current_user
from app.database import db

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


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
    notifications = await (
        db.get_collection("notifications")
        .find()
        .sort("created_at", -1)
        .limit(limit)
        .to_list(length=limit)
    )
    username = current_user["username"]
    items = [_serialize(item, username) for item in notifications]
    return {"items": items, "unread_count": sum(not item["read"] for item in items)}


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
