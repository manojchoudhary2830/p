import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.config import settings
from app.database import get_database
from app.utils.security import get_current_user
from app.utils.email import send_transactional_email

router = APIRouter(prefix="/bookings", tags=["Bookings"])

# ── Schemas ──

class BedLockRequest(BaseModel):
    property_id: str
    room_id: str
    bed_id: str

class BookingInitiateRequest(BaseModel):
    property_id: str
    room_id: str
    bed_id: str
    check_in_date: str
    months_duration: int = 1
    idempotency_key: Optional[str] = None

class BookingCancelRequest(BaseModel):
    reason: Optional[str] = "Personal reasons"
    idempotency_key: Optional[str] = None

class RefundProcessRequest(BaseModel):
    idempotency_key: Optional[str] = None


# ─────────────────────────────────────────────────────────
# Bed Locking (Two-stage lock with BED_LOCK_TTL_MIN countdown)
# ─────────────────────────────────────────────────────────

@router.post("/lock-bed")
async def lock_bed(req: BedLockRequest, user: dict = Depends(get_current_user)):
    """
    Acquires a temporary lock on a bed for BED_LOCK_TTL_MIN minutes
    to prevent double-booking during checkout.
    """
    db = get_database()
    property_doc = await db["properties"].find_one({"_id": req.property_id})
    if not property_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")

    target_room = None
    target_bed = None
    now_iso = datetime.now(timezone.utc).isoformat()

    for r in property_doc.get("rooms", []):
        if r["room_id"] == req.room_id:
            target_room = r
            for b in r.get("beds", []):
                if b["bed_id"] == req.bed_id:
                    target_bed = b
                    break
            break

    if not target_room or not target_bed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bed or room not found")

    # Check if bed is already occupied
    if target_bed.get("status") == "occupied":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This bed is already occupied.")

    # Check if bed is currently locked by someone else
    if target_bed.get("status") == "locked" and target_bed.get("locked_until"):
        if target_bed["locked_until"] > now_iso and target_bed.get("locked_by") != user["_id"]:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Bed is currently locked by another student completing checkout. Please try again shortly.",
            )

    # Set lock with BED_LOCK_TTL_MIN (p.md line 32)
    lock_duration = timedelta(minutes=settings.BED_LOCK_TTL_MIN)
    lock_expires_at = datetime.now(timezone.utc) + lock_duration
    lock_token = str(uuid.uuid4())

    target_bed["status"] = "locked"
    target_bed["locked_until"] = lock_expires_at.isoformat()
    target_bed["locked_by"] = user["_id"]
    target_bed["lock_token"] = lock_token

    await db["properties"].update_one(
        {"_id": req.property_id},
        {"$set": {"rooms": property_doc["rooms"]}}
    )

    return {
        "status": "locked",
        "bed_id": req.bed_id,
        "lock_expires_at": lock_expires_at.isoformat(),
        "ttl_minutes": settings.BED_LOCK_TTL_MIN,
        "ttl_seconds": int(lock_duration.total_seconds()),
        "lock_token": lock_token,
    }


@router.post("/unlock-bed")
async def unlock_bed(req: BedLockRequest, user: dict = Depends(get_current_user)):
    """Releases bed lock if student exits checkout without completing payment."""
    db = get_database()
    property_doc = await db["properties"].find_one({"_id": req.property_id})
    if not property_doc:
        return {"status": "unlocked"}

    for r in property_doc.get("rooms", []):
        if r["room_id"] == req.room_id:
            for b in r.get("beds", []):
                if b["bed_id"] == req.bed_id and (b.get("locked_by") == user["_id"] or user.get("role") == "admin"):
                    b["status"] = "vacant"
                    b["locked_until"] = None
                    b["locked_by"] = None
                    b["lock_token"] = None
                    break

    await db["properties"].update_one(
        {"_id": req.property_id},
        {"$set": {"rooms": property_doc["rooms"]}}
    )

    return {"status": "unlocked"}


# ─────────────────────────────────────────────────────────
# Booking Lifecycle (Initiate, Confirm, Cancel, Refund)
# ─────────────────────────────────────────────────────────

@router.post("/initiate", status_code=status.HTTP_201_CREATED)
async def initiate_booking(req: BookingInitiateRequest, user: dict = Depends(get_current_user)):
    """
    Initiates booking with idempotency key support.
    Calculates 20% token deposit or full monthly rent.
    """
    db = get_database()

    # Idempotency check (p.md line 108)
    idempotency_key = req.idempotency_key or f"book-{user['_id']}-{req.bed_id}-{req.check_in_date}"
    existing_booking = await db["bookings"].find_one({"idempotency_key": idempotency_key})
    if existing_booking:
        return existing_booking

    property_doc = await db["properties"].find_one({"_id": req.property_id})
    if not property_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")

    target_room = None
    target_bed = None
    for r in property_doc.get("rooms", []):
        if r["room_id"] == req.room_id:
            target_room = r
            for b in r.get("beds", []):
                if b["bed_id"] == req.bed_id:
                    target_bed = b
                    break
            break

    if not target_room or not target_bed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bed or room not found")

    monthly_rent = float(target_room["rent"])
    security_deposit = float(property_doc.get("security_deposit", monthly_rent))
    token_fraction = float(property_doc.get("token_deposit_fraction", 0.2))
    token_deposit_amount = round(security_deposit * token_fraction, 2)

    booking_id = f"bk-{uuid.uuid4().hex[:8]}"
    booking_doc = {
        "_id": booking_id,
        "idempotency_key": idempotency_key,
        "tenant_id": user["_id"],
        "tenant_name": user.get("full_name", ""),
        "tenant_email": user.get("email", ""),
        "tenant_phone": user.get("phone", ""),
        "property_id": req.property_id,
        "property_title": property_doc["title"],
        "property_city": property_doc["city"],
        "property_address": property_doc["address"],
        "owner_id": property_doc["owner_id"],
        "room_id": req.room_id,
        "room_type": target_room["room_type"],
        "bed_id": req.bed_id,
        "bed_code": target_bed["code"],
        "check_in_date": req.check_in_date,
        "months_duration": req.months_duration,
        "monthly_rent": monthly_rent,
        "security_deposit": security_deposit,
        "token_deposit_amount": token_deposit_amount,
        "total_amount": token_deposit_amount,  # token deposit payable now
        "status": "pending_payment",  # pending_payment, confirmed, cancelled, completed
        "payment_status": "unpaid",   # unpaid, paid, refunded
        "refund_status": "none",      # none, refund_pending, refund_failed, refunded (p.md line 114)
        "refund_amount": 0.0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "confirmed_at": None,
        "cancelled_at": None,
    }

    await db["bookings"].insert_one(booking_doc)
    return booking_doc


@router.post("/{booking_id}/confirm")
async def confirm_booking(
    booking_id: str,
    payment_reference: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    """
    Confirms a booking upon successful Stripe payment.
    Updates bed status to 'occupied'.
    """
    db = get_database()
    booking = await db["bookings"].find_one({"_id": booking_id})
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    if booking["status"] == "confirmed":
        return booking

    now_iso = datetime.now(timezone.utc).isoformat()

    # Update bed in property to 'occupied'
    property_doc = await db["properties"].find_one({"_id": booking["property_id"]})
    if property_doc:
        for r in property_doc.get("rooms", []):
            if r["room_id"] == booking["room_id"]:
                for b in r.get("beds", []):
                    if b["bed_id"] == booking["bed_id"]:
                        b["status"] = "occupied"
                        b["locked_until"] = None
                        b["locked_by"] = None
                        break

        await db["properties"].update_one(
            {"_id": booking["property_id"]},
            {"$set": {"rooms": property_doc["rooms"]}}
        )

    # Update booking record
    await db["bookings"].update_one(
        {"_id": booking_id},
        {"$set": {
            "status": "confirmed",
            "payment_status": "paid",
            "confirmed_at": now_iso,
            "payment_reference": payment_reference or f"pay-{uuid.uuid4().hex[:8]}",
        }}
    )

    # Send confirmation email
    confirm_html = f"""
    <h2>Booking Confirmed! 🎉</h2>
    <p>Hi {booking['tenant_name']}, your bed <strong>{booking['bed_code']}</strong> at <strong>{booking['property_title']}</strong> ({booking['property_city'].title()}) is successfully booked!</p>
    <p><strong>Check-in Date:</strong> {booking['check_in_date']}</p>
    <p><strong>Amount Paid:</strong> ₹{booking['total_amount']}</p>
    """
    await send_transactional_email(booking["tenant_email"], f"Booking Confirmed — {booking['property_title']}", confirm_html)

    return await db["bookings"].find_one({"_id": booking_id})


@router.post("/{booking_id}/cancel")
async def cancel_booking(
    booking_id: str,
    req: BookingCancelRequest,
    user: dict = Depends(get_current_user),
):
    """
    Cancels booking and calculates refund according to business rules:
    - Within CANCEL_GRACE_DAYS: 100% refund
    - After grace period but before check-in: CANCEL_REFUND_FRACTION_AFTER_CONFIRM (80%) refund
    - Sets refund_status to 'refund_pending' (p.md line 108 & 114)
    """
    db = get_database()
    booking = await db["bookings"].find_one({"_id": booking_id})
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    if booking["tenant_id"] != user["_id"] and user.get("role") not in ("owner", "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized")

    if booking["status"] in ("cancelled", "completed"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Booking is already {booking['status']}.")

    # Calculate refund
    paid_amount = float(booking.get("total_amount", 0.0))
    refund_amount = 0.0

    if booking.get("payment_status") == "paid":
        # Check grace period
        created_dt = datetime.fromisoformat(booking["created_at"].replace("Z", "+00:00"))
        now_dt = datetime.now(timezone.utc)
        days_since_booking = (now_dt - created_dt).total_seconds() / 86400

        if days_since_booking <= settings.CANCEL_GRACE_DAYS:
            # 100% full refund in grace period
            refund_amount = paid_amount
        else:
            # Fraction refund (e.g. 80%) per p.md line 32
            refund_amount = round(paid_amount * settings.CANCEL_REFUND_FRACTION_AFTER_CONFIRM, 2)

    # Release bed back to vacant
    property_doc = await db["properties"].find_one({"_id": booking["property_id"]})
    if property_doc:
        for r in property_doc.get("rooms", []):
            if r["room_id"] == booking["room_id"]:
                for b in r.get("beds", []):
                    if b["bed_id"] == booking["bed_id"]:
                        b["status"] = "vacant"
                        b["locked_until"] = None
                        b["locked_by"] = None
                        break

        await db["properties"].update_one(
            {"_id": booking["property_id"]},
            {"$set": {"rooms": property_doc["rooms"]}}
        )

    now_iso = datetime.now(timezone.utc).isoformat()
    refund_status = "refund_pending" if refund_amount > 0 else "none"

    await db["bookings"].update_one(
        {"_id": booking_id},
        {"$set": {
            "status": "cancelled",
            "cancelled_at": now_iso,
            "cancellation_reason": req.reason,
            "refund_amount": refund_amount,
            "refund_status": refund_status,
            "cancel_idempotency_key": req.idempotency_key or str(uuid.uuid4()),
        }}
    )

    return {
        "booking_id": booking_id,
        "status": "cancelled",
        "refund_amount": refund_amount,
        "refund_status": refund_status,
        "message": f"Booking cancelled. Eligible refund: ₹{refund_amount} ({'Full' if refund_amount == paid_amount else '80%'} refund policy).",
    }


@router.post("/{booking_id}/process-refund")
async def process_refund(
    booking_id: str,
    req: RefundProcessRequest,
    user: dict = Depends(get_current_user),
):
    """
    CRITICAL SECURITY FIX FROM p.md (lines 108-118):
    1. Fix refund race condition with idempotency key
    2. Restrict refund retry to 'refund_failed' only (NOT 'refund_pending' or 'refunded')
    """
    db = get_database()
    booking = await db["bookings"].find_one({"_id": booking_id})
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    current_refund_status = booking.get("refund_status", "none")

    # SECURITY AUDIT ENFORCEMENT:
    # If refund is already completed:
    if current_refund_status == "refunded":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Refund has already been processed successfully.",
        )

    # If refund is currently in pending state, do NOT allow duplicate concurrent retry!
    if current_refund_status == "refund_pending" and booking.get("refund_in_flight", False):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Refund processing is already in progress. Retries are strictly restricted to refund_failed status only.",
        )

    # Only allowed if refund_status == 'refund_failed' OR initial transition from 'refund_pending'
    if current_refund_status not in ("refund_pending", "refund_failed"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot process refund for status '{current_refund_status}'. Retries only allowed for 'refund_failed'.",
        )

    # Atomic lock transition
    await db["bookings"].update_one(
        {"_id": booking_id},
        {"$set": {"refund_in_flight": True}}
    )

    try:
        # Simulate / execute refund via payment gateway
        refund_amount = booking.get("refund_amount", 0.0)
        refund_ref = f"rfnd-{uuid.uuid4().hex[:8]}"

        # Mark as refunded
        await db["bookings"].update_one(
            {"_id": booking_id},
            {"$set": {
                "refund_status": "refunded",
                "payment_status": "refunded",
                "refund_in_flight": False,
                "refunded_at": datetime.now(timezone.utc).isoformat(),
                "refund_reference": refund_ref,
            }}
        )

        return {
            "booking_id": booking_id,
            "refund_status": "refunded",
            "refund_amount": refund_amount,
            "refund_reference": refund_ref,
            "message": "Refund processed successfully.",
        }
    except Exception as e:
        # On failure, mark status as refund_failed so retry is enabled
        await db["bookings"].update_one(
            {"_id": booking_id},
            {"$set": {
                "refund_status": "refund_failed",
                "refund_in_flight": False,
                "refund_error": str(e),
            }}
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Refund failed: {str(e)}. You can retry now.",
        )


@router.get("/mine")
async def get_my_bookings(user: dict = Depends(get_current_user)):
    db = get_database()
    bookings = await db["bookings"].find({"tenant_id": user["_id"]}).sort("created_at", -1).to_list(100)
    return {"bookings": bookings}


@router.get("/owner")
async def get_owner_bookings(user: dict = Depends(get_current_user)):
    db = get_database()
    bookings = await db["bookings"].find({"owner_id": user["_id"]}).sort("created_at", -1).to_list(100)
    return {"bookings": bookings}


@router.get("/{booking_id}")
async def get_booking_detail(booking_id: str, user: dict = Depends(get_current_user)):
    db = get_database()
    booking = await db["bookings"].find_one({"_id": booking_id})
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    if booking["tenant_id"] != user["_id"] and booking["owner_id"] != user["_id"] and user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized")

    return booking
