import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from app.core.config import settings

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