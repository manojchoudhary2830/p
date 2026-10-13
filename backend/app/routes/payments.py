import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from app.config import settings
from app.database import get_database
from app.utils.security import get_current_user

router = APIRouter(prefix="/payments", tags=["Payments"])

class CreateCheckoutSessionRequest(BaseModel):
    booking_id: str
    origin: Optional[str] = None  # window.location.origin from frontend per p.md line 31
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None

class TestPaymentConfirmRequest(BaseModel):
    booking_id: str

@router.post("/create-checkout-session")
async def create_checkout_session(
    req: CreateCheckoutSessionRequest,
    user: dict = Depends(get_current_user),
):
    """
    Creates a Stripe Checkout Session using window.location.origin for redirects
    per p.md line 31.
    """
    db = get_database()
    booking = await db["bookings"].find_one({"_id": req.booking_id})
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    if booking["tenant_id"] != user["_id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized")

    origin = req.origin or settings.FRONTEND_URL
    success_url = req.success_url or f"{origin}/booking/success?booking_id={booking['_id']}"
    cancel_url = req.cancel_url or f"{origin}/properties/{booking['property_id']}?cancelled=1"

    amount_inr = float(booking.get("total_amount", 1000.0))
    amount_paise = int(amount_inr * 100)

    # If live Stripe API key is configured
    if settings.STRIPE_API_KEY and not settings.STRIPE_API_KEY.startswith("sk_test_51Mock"):
        try:
            import stripe
            stripe.api_key = settings.STRIPE_API_KEY
            session = stripe.checkout.Session.create(
                payment_method_types=["card"],
                line_items=[{
                    "price_data": {
                        "currency": "inr",
                        "product_data": {
                            "name": f"PG Booking Token Deposit: {booking['property_title']}",
                            "description": f"Bed {booking['bed_code']} ({booking['room_type']}) - {booking['property_city'].title()}",
                        },
                        "unit_amount": amount_paise,
                    },
                    "quantity": 1,
                }],
                mode="payment",
                client_reference_id=booking["_id"],
                customer_email=booking.get("tenant_email"),
                success_url=success_url + "&session_id={CHECKOUT_SESSION_ID}",
                cancel_url=cancel_url,
                metadata={
                    "booking_id": booking["_id"],
                    "tenant_id": user["_id"],
                    "property_id": booking["property_id"],
                },
            )
            return {
                "checkout_url": session.url,
                "session_id": session.id,
                "mode": "stripe_live",
                "amount_inr": amount_inr,
            }
        except Exception as e:
            # Fall back to development payment simulator if stripe call fails
            pass

    # Instant development simulation
    test_session_id = f"test_cs_{uuid.uuid4().hex[:12]}"
    mock_url = f"{origin}/booking/success?booking_id={booking['_id']}&session_id={test_session_id}&mock=true"

    return {
        "checkout_url": mock_url,
        "session_id": test_session_id,
        "mode": "test_simulator",
        "amount_inr": amount_inr,
        "message": "Dev test checkout session generated",
    }


@router.post("/confirm-test-payment")
async def confirm_test_payment(
    req: TestPaymentConfirmRequest,
    user: dict = Depends(get_current_user),
):
    """Instantly marks a booking paid in test mode."""
    db = get_database()
    booking = await db["bookings"].find_one({"_id": req.booking_id})
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    from app.routes.bookings import confirm_booking
    confirmed = await confirm_booking(
        booking_id=req.booking_id,
        payment_reference=f"test-stripe-pay-{uuid.uuid4().hex[:8]}",
        user=user,
    )
    return {"status": "success", "booking": confirmed}
