# watchman/app/core/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import computed_field # Import this
from typing import List
from urllib.parse import quote_plus

class Settings(BaseSettings):
    # --- Project Metadata ---
    PROJECT_NAME: str = "Sentry-Pod Watchman"
    VERSION: str = "1.0.0"

    # --- Database Settings ---
    # These will be overridden by .env if they exist there
    DB_USER: str = "sanuja_admin"
    DB_PASS: str = "Admin@123"

    # Use @computed_field so Pydantic treats it like a real attribute
    @computed_field
    @property
    def MONGO_URI(self) -> str:
        user = quote_plus(self.DB_USER)
        password = quote_plus(self.DB_PASS)
        return f"mongodb+srv://{user}:{password}@sentrypod.n5boezy.mongodb.net/?appName=SentryPod"

    # --- Security & JWT ---
    SECRET_KEY: str = "7ba8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 240

    # --- CORS Settings ---
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
    ]

    model_config = SettingsConfigDict(
        env_file=".env", 
        case_sensitive=True, 
        extra="ignore"
    )

settings = Settings()