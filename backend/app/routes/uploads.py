import os
import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from app.config import settings
from app.utils.security import get_current_user

router = APIRouter(prefix="/uploads", tags=["Uploads"])

# Security Audit fix: Safe content types only (p.md line 102)
ALLOWED_MIME_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}

# Magic bytes signature validation for image safety
MAGIC_NUMBERS = {
    b"\xff\xd8\xff": "image/jpeg",
    b"\x89PNG\r\n\x1a\n": "image/png",
    b"RIFF": "image/webp",
}

def validate_magic_bytes(content: bytes) -> bool:
    for magic, mime in MAGIC_NUMBERS.items():
        if content.startswith(magic):
            return True
    return False

@router.post("", status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """
    Secure file upload endpoint per p.md line 102:
    - Enforces safe MIME type (JPEG, PNG, WEBP)
    - Validates file headers
    - Enforces strict file size cap (5MB)
    - Saves with random UUID filename
    """
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type '{file.content_type}'. Only JPEG, PNG, and WebP images are allowed.",
        )

    # Read content with size check
    content = await file.read()
    if len(content) > settings.MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE_BYTES // (1024*1024)}MB.",
        )

    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    # Verify header signature
    if not validate_magic_bytes(content):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File content does not match the declared image format.",
        )

    # Generate safe random filename
    ext = ALLOWED_MIME_TYPES[file.content_type]
    safe_filename = f"{uuid.uuid4().hex}{ext}"
    target_path = settings.UPLOAD_DIR / safe_filename

    with open(target_path, "wb") as f:
        f.write(content)

    file_url = f"{settings.STORAGE_URL}/{safe_filename}"
    return {
        "url": file_url,
        "filename": safe_filename,
        "size_bytes": len(content),
        "content_type": file.content_type,
    }


@router.get("/{filename}")
async def serve_file(filename: str):
    """
    Serves uploaded files with X-Content-Type-Options: nosniff header
    per p.md security audit line 102.
    """
    # Prevent directory traversal
    clean_filename = Path(filename).name
    file_path = settings.UPLOAD_DIR / clean_filename

    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    ext = file_path.suffix.lower()
    media_type = "image/jpeg"
    if ext == ".png":
        media_type = "image/png"
    elif ext == ".webp":
        media_type = "image/webp"

    response = FileResponse(path=file_path, media_type=media_type)
    # SECURITY FIX: Add nosniff header
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Cache-Control"] = "public, max-age=86400"
    return response
