import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from backend root
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

class Settings:
    APP_NAME: str = os.environ.get("APP_NAME", "NextGen PG Booking — Jaipur & NCR")
    PORT: int = int(os.environ.get("PORT", "8001"))
    HOST: str = os.environ.get("HOST", "0.0.0.0")
    ENVIRONMENT: str = os.environ.get("ENVIRONMENT", "development")

    # Database
    MONGO_URL: str = os.environ.get("MONGO_URL", "mongodb://localhost:27017/pgbooking")
    DB_NAME: str = os.environ.get("DB_NAME", "pgbooking")

    # Security & Auth
    JWT_SECRET: str = os.environ.get("JWT_SECRET", "super_secret_jwt_key_pgbooking_2026")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

    # Storage - note: reads from os.environ.get('STORAGE_URL', '/uploads') per p.md line 30
    STORAGE_URL: str = os.environ.get("STORAGE_URL", "/uploads")
    UPLOAD_DIR: Path = BASE_DIR / "uploads"
    MAX_UPLOAD_SIZE_BYTES: int = 5 * 1024 * 1024  # 5 MB cap (line 102)

    # Payments (Stripe)
    STRIPE_API_KEY: str = os.environ.get("STRIPE_API_KEY", "")
    STRIPE_WEBHOOK_SECRET: str = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

    # AI Assistant (Emergent LLM)
    EMERGENT_LLM_KEY: str = os.environ.get("EMERGENT_LLM_KEY", "")

    # Transactional Email (SendGrid)
    SENDGRID_API_KEY: str = os.environ.get("SENDGRID_API_KEY", "")
    SENDER_EMAIL: str = os.environ.get("SENDER_EMAIL", "manoj.portfolio.website@gmail.com")

    # Inventory & Booking Business Rules
    BED_LOCK_TTL_MIN: int = int(os.environ.get("BED_LOCK_TTL_MIN", "10"))
    BOOST_PRICE_INR: float = float(os.environ.get("BOOST_PRICE_INR", "499"))
    BOOST_DURATION_DAYS: int = int(os.environ.get("BOOST_DURATION_DAYS", "30"))
    CANCEL_REFUND_FRACTION_AFTER_CONFIRM: float = float(os.environ.get("CANCEL_REFUND_FRACTION_AFTER_CONFIRM", "0.8"))
    CANCEL_GRACE_DAYS: int = int(os.environ.get("CANCEL_GRACE_DAYS", "2"))

    # Frontend URL & CORS
    FRONTEND_URL: str = os.environ.get("FRONTEND_URL", "http://localhost:3000")
    _extra_origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
    CORS_ORIGINS: list[str] = list(dict.fromkeys([
        os.environ.get("FRONTEND_URL", "http://localhost:3000"),
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        *_extra_origins,
    ]))

settings = Settings()
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
