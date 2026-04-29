# watchman/app/core/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

class Settings(BaseSettings):
    # --- Project Metadata ---
    PROJECT_NAME: str = "Sentry-Pod Watchman"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"

    # --- Database Settings ---
    # This defaults to the Podman service name 'vault'
    DATABASE_URL: str = "mongodb://sentry_pod:Admin123@vault:27017/sentry_nms?authSource=admin"

    # --- Security & JWT ---
    # IMPORTANT: In production, never hardcode this! 
    # Use: openssl rand -hex 32 to generate a real one
    SECRET_KEY: str = "7ba8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 240  # 4 hours

    # --- CORS Settings ---
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:3000"]

    # This tells Pydantic to look for a .env file if it exists
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)

# Create a single instance to be imported elsewhere
settings = Settings()