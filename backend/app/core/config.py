from pydantic_settings import BaseSettings
from typing import List, Optional
from functools import lru_cache
import os


class Settings(BaseSettings):
    # Server
    APP_NAME: str = "SmartBill AI - Ledger & Billing Management"
    APP_ENV: str = "development"
    SECRET_KEY: str = "dev-secret-key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # Database
    DATABASE_URL: str = "sqlite:///./billing.db"

    # Gemini API Keys (up to 5 for rotation)
    GEMINI_API_KEY_1: Optional[str] = None
    GEMINI_API_KEY_2: Optional[str] = None
    GEMINI_API_KEY_3: Optional[str] = None
    GEMINI_API_KEY_4: Optional[str] = None
    GEMINI_API_KEY_5: Optional[str] = None

    # File Storage
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE_MB: int = 10

    # Cloudinary Storage
    CLOUDINARY_CLOUD_NAME: Optional[str] = "dwjevegye"
    CLOUDINARY_API_KEY: Optional[str] = None
    CLOUDINARY_API_SECRET: Optional[str] = "9Ig1iPEfrlTOSTArhyhIg23mLFY"

    # WhatsApp Gateway - OpenWA (https://github.com/rmyndharis/OpenWA)
    OPENWA_BASE_URL: str = "http://localhost:2785"
    OPENWA_SESSION_ID: str = "default"
    OPENWA_API_KEY: Optional[str] = None
    OPENWA_DELAY_SECONDS: int = 60

    # WhatsApp Cloud API / Custom Gateway (Optional Alternatives)
    WHATSAPP_PHONE_NUMBER_ID: Optional[str] = None
    WHATSAPP_ACCESS_TOKEN: Optional[str] = None
    WHATSAPP_GATEWAY_URL: Optional[str] = None
    WHATSAPP_GATEWAY_TOKEN: Optional[str] = None

    # CORS
    FRONTEND_URL: str = "http://localhost:5173"

    @property
    def gemini_api_keys(self) -> List[str]:
        """Returns a list of all configured non-null Gemini API keys."""
        raw = [
            self.GEMINI_API_KEY_1,
            self.GEMINI_API_KEY_2,
            self.GEMINI_API_KEY_3,
            self.GEMINI_API_KEY_4,
            self.GEMINI_API_KEY_5,
        ]
        return [k for k in raw if k]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache()
def get_settings() -> Settings:
    return Settings()
