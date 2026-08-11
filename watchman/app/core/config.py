# watchman/app/core/config.py

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import computed_field
from typing import List
from urllib.parse import quote_plus


class Settings(BaseSettings):
    # -----------------------------
    # Project
    # -----------------------------
    PROJECT_NAME: str = "Sentry-Pod Watchman"
    VERSION: str = "1.0.0"

    # -----------------------------
    # MongoDB
    # -----------------------------
    DB_USER: str
    DB_PASS: str
    DB_HOST: str
    DB_NAME: str = "sentry_pod_db"

    @computed_field
    @property
    def MONGO_URI(self) -> str:
        user = quote_plus(self.DB_USER)
        password = quote_plus(self.DB_PASS)

        return (
            f"mongodb+srv://{user}:{password}"
            f"@{self.DB_HOST}/{self.DB_NAME}"
            f"?retryWrites=true&w=majority"
        )

    # -----------------------------
    # JWT
    # -----------------------------
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120

    # -----------------------------
    # CORS
    # -----------------------------
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()