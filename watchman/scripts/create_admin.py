# scripts/create_admin.py
import asyncio
import os
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.core.security import get_password_hash

async def create_first_admin():
    # Use the same URL from your podman-compose
    # Since this script runs on the host, use 'localhost' instead of 'vault'
    MONGO_URL = "mongodb://sentry_pod:Admin123@localhost:27017/sentry_pod_db?authSource=admin"
    client = AsyncIOMotorClient(MONGO_URL)
    db = client.sentry_pod_db

    admin_data = {
        "username": "admin",
        "email": "admin@sentrypod.io",
        "full_name": "System Administrator",
        "password": get_password_hash("SentrySecure2026"),
        "role": "admin",
        "is_active": True,
        "created_at": datetime.now(),
        "login_history": []
    }

    try:
        existing_user = await db.users.find_one({"username": "admin"})
        if existing_user:
            print("❌ Admin user already exists!")
            return

        result = await db.users.insert_one(admin_data)
        print(f"✅ Admin created successfully! ID: {result.inserted_id}")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(create_first_admin())