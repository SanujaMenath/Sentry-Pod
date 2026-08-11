"""
One-time migration: sync users from Atlas to local vault MongoDB.
Reads MONGO_URI from .env (Atlas). Only touches the 'users' collection.
"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

ATLAS_URI = os.getenv("MONGO_URI")
LOCAL_URI = "mongodb://sentry_pod:Admin123@127.0.0.1:27017/sentry_pod_db?authSource=admin"
DB_NAME = "sentry_pod_db"


async def main():
    if not ATLAS_URI:
        print("ERROR: MONGO_URI not found in .env")
        return

    atlas = AsyncIOMotorClient(ATLAS_URI)
    local = AsyncIOMotorClient(LOCAL_URI)

    users = await atlas[DB_NAME].users.find().to_list(length=1000)
    print(f"Found {len(users)} users in Atlas")

    synced = 0
    for user in users:
        username = user.get("username")
        if username:
            await local[DB_NAME].users.delete_one({"username": username})
        user_id = user["_id"]
        await local[DB_NAME].users.replace_one(
            {"_id": user_id}, user, upsert=True
        )
        synced += 1

    print(f"Synced {synced} users to local vault")
    atlas.close()
    local.close()


if __name__ == "__main__":
    asyncio.run(main())
