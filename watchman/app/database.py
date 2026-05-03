import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load variables from .env
load_dotenv()

# Fetch the URI from environment variables
MONGO_URI = os.getenv("MONGO_URI")

# Initialize the client
client = AsyncIOMotorClient(MONGO_URI)

# Access your specific database
# You can name it 'sentry_pod_db' as planned
db = client.sentry_pod_db

# Access collections for your features
devices_collection = db.get_collection("devices")
logs_collection = db.get_collection("logs")