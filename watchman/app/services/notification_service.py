"""Small persistence layer for user-visible system notifications."""
from datetime import datetime, timezone
from typing import Optional

from app.database import db


async def publish_notification(
    *,
    title: str,
    message: str,
    category: str,
    severity: str = "info",
    link: Optional[str] = None,
) -> None:
    """Store a global notification. Read state is tracked per username."""
    await db.get_collection("notifications").insert_one(
        {
            "title": title,
            "message": message,
            "category": category,
            "severity": severity,
            "link": link,
            "created_at": datetime.now(timezone.utc),
            "read_by": [],
        }
    )
