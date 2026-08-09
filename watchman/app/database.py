import os
import logging
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from app.core.config import settings

logger = logging.getLogger(__name__)

# Load variables from .env
load_dotenv()

# Fetch the URI from environment variables, fall back to settings.MONGO_URI
MONGO_URI = os.getenv("MONGO_URI") or settings.MONGO_URI

# Initialize the client
client = AsyncIOMotorClient(MONGO_URI, tz_aware=True)

# Access your specific database
db = client.sentry_pod_db

# Access collections for your features
devices_collection = db.get_collection("devices")
logs_collection = db.get_collection("logs")
device_configurations_collection = db.get_collection("device_configurations")
api_keys_collection = db.get_collection("api_keys")
playbooks_collection = db.get_collection("playbooks")
conversations_collection = db.get_collection("conversations")
syslog_alerts_collection = db.get_collection("syslog_alerts")
users_collection = db.get_collection("users")


async def create_indexes():
    """Create indexes for all collections. Idempotent (safe to call on every startup)."""
    try:
        await users_collection.create_index("username", unique=True)
        await users_collection.create_index("email", unique=True)

        await conversations_collection.create_index([("updated_at", -1)])

        await logs_collection.create_index([("timestamp", -1)])
        await logs_collection.create_index([("username", 1)])
        await logs_collection.create_index([("action_name", 1)])

        await syslog_alerts_collection.create_index([("timestamp", -1)])

        await devices_collection.create_index([("name", 1)], unique=True)
        await devices_collection.create_index([("ip", 1)])

        await device_configurations_collection.create_index("device_id", unique=True)

        await playbooks_collection.create_index("name")

        logger.info("Database indexes created/verified successfully")
    except Exception as e:
        logger.warning(f"Could not create indexes: {e}")