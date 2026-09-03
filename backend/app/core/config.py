import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "SpendWise 2.0"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "spendwise_secret_key_super_secure_2026_dev")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Fallback to SQLite for zero-config local run, postgresql:// user:pass@host/db if set
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./spendwise.db")
    
    class Config:
        case_sensitive = True

settings = Settings()
