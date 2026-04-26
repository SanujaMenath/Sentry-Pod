from fastapi import FastAPI
from motor.motor_asyncio import AsyncIOMotorClient
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
import os
from app.api.v1 import auth

app = FastAPI(title=settings.PROJECT_NAME, version=settings.VERSION)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])

# Database Setup
client = AsyncIOMotorClient(settings.DATABASE_URL)
db = client.sentry_nms

@app.get("/")
async def root():
    return {"message": "Sentry-Pod API is live"}

@app.get("/api/health")
async def health_check():
    try:
        await db.command("ping")
        return {"status": "online", "database": "connected"}
    except Exception as e:
        return {"status": "online", "database": "error", "details": str(e)}