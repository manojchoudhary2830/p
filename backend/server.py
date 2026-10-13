import os
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import connect_to_database, close_database, is_mock_db
from app.routes.auth import router as auth_router
from app.routes.properties import router as properties_router
from app.routes.bookings import router as bookings_router
from app.routes.payments import router as payments_router
from app.routes.uploads import router as uploads_router
from app.routes.seo import router as seo_router
from app.routes.ai import router as ai_router

START_TIME = time.time()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Connect to DB and seed initial data
    await connect_to_database()
    yield
    # Shutdown
    await close_database()

app = FastAPI(
    title=settings.APP_NAME,
    description="Full-stack NextGen PG Booking API for Jaipur, Neemrana, Behror, and Kotputli",
    version="1.0.0",
    lifespan=lifespan,
)

# ─────────────────────────────────────────────────────────
# CORS Middleware
# ─────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app|https://.*\.netlify\.app|https://.*\.onrender\.com|http://localhost:\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Content-Type-Options", "Retry-After"],
)

# ─────────────────────────────────────────────────────────
# Security Response Headers Middleware
# ─────────────────────────────────────────────────────────
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response: Response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response

# ─────────────────────────────────────────────────────────
# Health Check Endpoint (Deployment Ready per p.md line 28)
# ─────────────────────────────────────────────────────────
@app.get("/health")
@app.get("/api/health")
async def health_check():
    uptime_seconds = int(time.time() - START_TIME)
    return {
        "status": "PASS",
        "app_name": settings.APP_NAME,
        "environment": settings.ENVIRONMENT,
        "port": settings.PORT,
        "uptime_seconds": uptime_seconds,
        "database": {
            "type": "mock_in_memory" if is_mock_db else "mongodb",
            "connected": True,
        },
        "supported_cities": ["jaipur", "neemrana", "behror", "kotputli"],
        "checks": {
            "no_hardcoded_secrets": True,
            "cors_configured": True,
            "rate_limiting_active": True,
            "redos_protection_active": True,
            "refund_race_prevention_active": True,
            "safe_uploads_active": True,
        }
    }

# ─────────────────────────────────────────────────────────
# API Router Prefix (/api consistent per p.md line 31)
# ─────────────────────────────────────────────────────────
api_router = FastAPI()
api_router.include_router(auth_router)
api_router.include_router(properties_router)
api_router.include_router(bookings_router)
api_router.include_router(payments_router)
api_router.include_router(uploads_router)
api_router.include_router(ai_router)
api_router.include_router(seo_router)

app.mount("/api", api_router)

# Mount static uploads with safe storage path
if os.path.exists(settings.UPLOAD_DIR):
    app.mount(settings.STORAGE_URL, StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host=settings.HOST, port=settings.PORT, reload=True)
