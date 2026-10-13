import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr

from app.config import settings
from app.database import get_database
from app.ratelimit import rate_limit_login, rate_limit_forgot_password
from app.utils.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_user,
)
from app.utils.email import send_transactional_email

router = APIRouter(prefix="/auth", tags=["Authentication"])

# ── Schemas ──
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: str
    role: str = "tenant"  # 'tenant' or 'owner'

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(req: RegisterRequest):
    db = get_database()
    email_clean = req.email.lower().strip()

    existing = await db["users"].find_one({"email": email_clean})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists.",
        )

    user_doc = {
        "_id": str(uuid.uuid4()),
        "email": email_clean,
        "password_hash": get_password_hash(req.password),
        "full_name": req.full_name.strip(),
        "phone": req.phone.strip(),
        "role": req.role if req.role in ("tenant", "owner", "admin") else "tenant",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_active": True,
    }

    await db["users"].insert_one(user_doc)
    token = create_access_token({"sub": user_doc["_id"], "role": user_doc["role"], "email": email_clean})

    # Send welcome email via SendGrid
    welcome_html = f"""
    <h2>Welcome to {settings.APP_NAME}!</h2>
    <p>Hi {user_doc['full_name']}, your account has been created successfully.</p>
    <p>Explore verified PGs across Jaipur, Neemrana, Behror, and Kotputli.</p>
    """
    await send_transactional_email(email_clean, f"Welcome to {settings.APP_NAME}", welcome_html)

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user_doc["_id"],
            "email": user_doc["email"],
            "full_name": user_doc["full_name"],
            "role": user_doc["role"],
            "phone": user_doc["phone"],
        },
    }


@router.post("/login")
async def login(req: LoginRequest, request: Request):
    # Security Audit: Rate limiting applied per p.md line 74
    rate_limit_login(request, req.email)

    db = get_database()
    email_clean = req.email.lower().strip()
    user = await db["users"].find_one({"email": email_clean})

    if not user or not verify_password(req.password, user.get("password_hash", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is currently suspended.",
        )

    token = create_access_token({"sub": user["_id"], "role": user.get("role", "tenant"), "email": email_clean})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["_id"],
            "email": user["email"],
            "full_name": user.get("full_name", ""),
            "role": user.get("role", "tenant"),
            "phone": user.get("phone", ""),
        },
    }


@router.post("/forgot-password")
async def forgot_password(req: ForgotPasswordRequest, request: Request):
    # Security Audit: Rate limiting applied per p.md line 74
    rate_limit_forgot_password(request, req.email)

    db = get_database()
    email_clean = req.email.lower().strip()
    user = await db["users"].find_one({"email": email_clean})

    # Always return a generic success message to prevent user enumeration attacks
    if not user:
        return {"message": "If that email is registered, password reset instructions have been sent."}

    reset_token = str(uuid.uuid4())
    expiry = datetime.now(timezone.utc) + timedelta(hours=1)

    await db["password_resets"].insert_one({
        "token": reset_token,
        "user_id": user["_id"],
        "email": email_clean,
        "expires_at": expiry.isoformat(),
        "used": False,
    })

    reset_link = f"{settings.FRONTEND_URL}/reset-password?token={reset_token}"

    email_html = f"""
    <h3>Password Reset Request</h3>
    <p>Hello {user.get('full_name', 'User')},</p>
    <p>A password reset was requested for your {settings.APP_NAME} account.</p>
    <p><a href="{reset_link}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Reset My Password</a></p>
    <p>This link expires in 60 minutes. If you did not request this, please disregard this email.</p>
    """

    # NOTE: Per security audit in p.md line 74: DO NOT log the reset link!
    await send_transactional_email(email_clean, f"Password Reset — {settings.APP_NAME}", email_html)

    return {"message": "If that email is registered, password reset instructions have been sent."}


@router.post("/reset-password")
async def reset_password(req: ResetPasswordRequest):
    db = get_database()
    record = await db["password_resets"].find_one({"token": req.token, "used": False})

    if not record:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token.")

    expiry_dt = datetime.fromisoformat(record["expires_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > expiry_dt:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password reset token has expired.")

    new_hash = get_password_hash(req.new_password)
    await db["users"].update_one(
        {"_id": record["user_id"]},
        {"$set": {"password_hash": new_hash}}
    )
    await db["password_resets"].update_one(
        {"_id": record["_id"]},
        {"$set": {"used": True}}
    )

    return {"message": "Password updated successfully. You can now log in with your new password."}


@router.get("/me")
async def get_me(user: dict = Depends(get_current_user)):
    return {
        "id": user["_id"],
        "email": user["email"],
        "full_name": user.get("full_name", ""),
        "role": user.get("role", "tenant"),
        "phone": user.get("phone", ""),
        "avatar_url": user.get("avatar_url"),
        "created_at": user.get("created_at"),
    }


@router.put("/profile")
async def update_profile(req: ProfileUpdateRequest, user: dict = Depends(get_current_user)):
    db = get_database()
    update_data = {}
    if req.full_name is not None:
        update_data["full_name"] = req.full_name.strip()
    if req.phone is not None:
        update_data["phone"] = req.phone.strip()
    if req.avatar_url is not None:
        update_data["avatar_url"] = req.avatar_url

    if update_data:
        await db["users"].update_one({"_id": user["_id"]}, {"$set": update_data})

    updated_user = await db["users"].find_one({"_id": user["_id"]})
    return {
        "id": updated_user["_id"],
        "email": updated_user["email"],
        "full_name": updated_user.get("full_name", ""),
        "role": updated_user.get("role", "tenant"),
        "phone": updated_user.get("phone", ""),
        "avatar_url": updated_user.get("avatar_url"),
    }
