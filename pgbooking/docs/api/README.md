# API Reference

Base URL: `https://api.pgbooking.in/api/v1` (production) · `http://localhost:3000/api/v1` (dev)

All authenticated endpoints require `Authorization: Bearer <access_token>`.
All responses follow the envelope:

```json
{
  "status": "success" | "error",
  "data": { ... },
  "message": "Human-readable message",
  "meta": { "page": 1, "limit": 20, "total": 87 }
}
```

Validation errors (`422`) include an `errors` array:
```json
{ "status": "error", "errors": [{ "field": "phone_number", "message": "..." }] }
```

---

## Authentication

### `POST /auth/otp/send`
Send a 6-digit OTP via SMS. Rate limited to 3 requests/minute per phone number.

**Body**: `{ "phone_number": "+919876543210" }`
**Response** `202`: `{ "message": "OTP sent", "meta": { "resend_after_seconds": 60 } }`

### `POST /auth/otp/verify`
Verify OTP and receive a token pair. Creates a new user on first login.

**Body**: `{ "phone_number": "+919876543210", "otp": "123456", "device_info": { "platform": "android" } }`
**Response** `200`/`201`:
```json
{
  "data": {
    "access_token": "...", "refresh_token": "...",
    "token_type": "Bearer",
    "access_token_expires_at": "...", "refresh_token_expires_at": "...",
    "user": { "id": "...", "phone_number": "...", "account_role": "TENANT", "identity_kyc_status": "UNVERIFIED" },
    "is_new_user": true
  }
}
```

Errors: `422` invalid OTP format, `401` wrong OTP (includes attempts remaining), `429` locked after 3 failed attempts.

### `POST /auth/token/refresh`
Rotates the refresh token. Detects reuse of a revoked token and revokes the
entire token family as a security measure.

**Body**: `{ "refresh_token": "..." }` → new token pair

### `POST /auth/logout` 🔒
Revokes all refresh tokens and blacklists the current access token.

### `GET /auth/me` 🔒
Returns the current authenticated user's profile.

### `PATCH /auth/profile` 🔒
Complete profile after first OTP login.

**Body**: `{ "legal_full_name": "...", "email_address": "...", "account_role": "TENANT" | "OWNER" }`

---

## Properties

### `GET /properties/search`
PostGIS radius search. Public endpoint.

**Query params**: `lat`, `lng` (required), `radius_km` (0.5–50, default 5),
`gender_policy`, `min_rent`, `max_rent`, `amenities` (comma-separated),
`page`, `limit` (max 50)

**Response**: paginated list of properties with `distance_km`, `cover_photo_url`, `avg_rating`

### `GET /properties/:id`
Full property detail including all photos (signed URLs) and amenities.

### `POST /properties` 🔒 OWNER
Create a property listing. Starts in `PENDING` verification status.

### `PUT /properties/:id` 🔒 OWNER/ADMIN
Update property details.

### `DELETE /properties/:id` 🔒 OWNER/ADMIN
Soft-delete a property.

### `POST /properties/:id/photos` 🔒 OWNER
Multipart upload. Generates thumbnail/medium/large variants automatically.

### `POST /properties/:id/favorites` 🔒
Toggle favorite status for the authenticated tenant.

### `GET /properties/favorites` 🔒
List the authenticated tenant's favorited properties.

---

## Rooms & Beds

### `GET /properties/:propertyId/rooms`
List all rooms in a property with live vacancy counts.

### `GET /properties/:propertyId/rooms/:roomId`
Room detail including the full bed array (for the bed-selection UI).

### `POST /properties/:propertyId/rooms` 🔒 OWNER
### `PUT /properties/:propertyId/rooms/:roomId` 🔒 OWNER
### `DELETE /properties/:propertyId/rooms/:roomId` 🔒 OWNER

### `POST /rooms/:roomId/beds` 🔒 OWNER
**Body**: `{ "beds": [{ "bed_spatial_code": "A" }, { "bed_spatial_code": "B" }] }`

### `DELETE /rooms/:roomId/beds/:bedId` 🔒 OWNER
Fails with `400` if the bed is not `VACANT`.

---

## Bookings

### `POST /bookings` 🔒 TENANT
Initiate a booking. Acquires the two-stage lock (Redis + DB). Requires
verified KYC status.

**Headers**: `X-Idempotency-Key: <uuid>` (recommended)
**Body**: `{ "bed_id": "...", "intended_check_in": "2026-08-01" }`
**Response** `201`:
```json
{
  "data": {
    "booking_id": "...",
    "lock_expiration_timestamp": "...",
    "required_token_amount": 2400,
    "monthly_rent": 12000, "security_deposit": 12000,
    "property_name": "...", "room_code": "101", "bed_code": "A"
  }
}
```

Errors: `400` bed no longer available, `403` KYC not verified, `409` lock contention.

### `GET /bookings/mine` 🔒
Paginated list of the tenant's bookings.

### `GET /bookings/:id` 🔒
Booking detail. Tenant can only view their own; admin can view any.

### `POST /bookings/:id/cancel` 🔒
**Body**: `{ "reason": "..." }` (optional). Releases the bed back to `VACANT`.

### `GET /bookings/owner` 🔒 OWNER
All bookings across the owner's properties. Filterable by `?status=`.

### `POST /bookings/:id/checkout` 🔒 OWNER/ADMIN
**Body**: `{ "actual_check_out_date": "2026-12-01", "checkout_notes": "..." }`

---

## Payments

### `POST /payments/orders` 🔒 TENANT
Creates a Razorpay order for a booking's token deposit or rent.

**Body**: `{ "booking_id": "...", "purpose": "TOKEN_DEPOSIT" }`
**Response**: `{ "order_id": "order_...", "amount": 240000, "currency": "INR", "key": "rzp_..." }`
(amount is in paise, for direct use with the Razorpay client SDK)

### `POST /payments/verify` 🔒 TENANT
Verifies the HMAC-SHA256 signature returned by the Razorpay client SDK and
confirms the booking.

**Body**: `{ "razorpay_order_id": "...", "razorpay_payment_id": "...", "razorpay_signature": "...", "booking_id": "..." }`

### `POST /payments/webhook/razorpay`
Server-to-server webhook. Verifies `X-Razorpay-Signature` against the raw
request body. Idempotent — safe to receive the same event multiple times.
Not directly callable by clients.

### `GET /payments/mine` 🔒
Payment history for the authenticated user.

### `GET /payments/bookings/:bookingId` 🔒
All payments associated with a specific booking.

### `POST /payments/refund` 🔒 OWNER/ADMIN
**Body**: `{ "payment_id": "...", "amount": 1000, "reason": "..." }` (amount optional = full refund)

---

## Maintenance

### `POST /maintenance` 🔒
Multipart form. Up to 3 photos.
**Fields**: `booking_id`, `title`, `description`, `category`, `priority` (1–5), `photos[]`

### `GET /maintenance/mine` 🔒
### `GET /maintenance/:id` 🔒
Includes signed photo URLs and the comment thread (internal comments hidden from tenants).

### `PATCH /maintenance/:id/status` 🔒 OWNER/ADMIN
**Body**: `{ "status": "IN_PROGRESS" | "RESOLVED" | "CLOSED", "resolution_notes": "..." }`

### `POST /maintenance/:id/comments` 🔒
**Body**: `{ "content": "...", "is_internal": false }` (internal flag is OWNER/ADMIN only)

### `GET /maintenance/owner` 🔒 OWNER
Filterable by `?status=`.

---

## Notifications

### `GET /notifications` 🔒
Paginated. `?unread=true` to filter.

### `GET /notifications/unread-count` 🔒
### `POST /notifications/mark-read` 🔒 — `{ "ids": ["..."] }`
### `POST /notifications/mark-all-read` 🔒
### `PUT /notifications/fcm-token` 🔒 — `{ "fcm_token": "..." }`

---

## Owner Dashboard

### `GET /owner/dashboard` 🔒 OWNER
Aggregate stats: property/bed counts, occupancy rate, this/last month
revenue, pending action counts.

### `GET /owner/revenue?months=6` 🔒 OWNER
Monthly revenue time series for charting.

### `GET /owner/tenants` 🔒 OWNER
All active tenants across the owner's properties.

### `GET /owner/rent-due` 🔒 OWNER
Current month's rent payment status per active booking.

---

## Admin

All admin endpoints require `account_role = SYSTEM_ADMIN`.

| Endpoint | Description |
|---|---|
| `GET /admin/stats` | System-wide user/property/booking/revenue counts |
| `GET /admin/users` | Paginated user list, filterable by role/search |
| `PATCH /admin/users/:id/toggle-status` | Activate/deactivate an account |
| `PATCH /admin/users/:id/role` | Change a user's role |
| `GET /admin/properties/pending` | Properties awaiting verification |
| `PATCH /admin/properties/:id/verify` | `{ "status": "VERIFIED"\|"REJECTED"\|"SUSPENDED", "notes": "..." }` |
| `GET /admin/kyc/pending` | KYC documents awaiting review |
| `PATCH /admin/kyc/:id/review` | `{ "status": "VERIFIED"\|"REJECTED", "rejection_reason": "..." }` |
| `GET /admin/payments` | Full payment ledger, filterable |
| `GET /admin/audit-logs` | Append-only audit trail, filterable by `user_id` |

---

## Rate Limits

| Scope | Limit |
|---|---|
| Global (per user/IP) | Configurable via `RATE_LIMIT_GLOBAL_MAX` / window |
| Auth endpoints | Stricter window, keyed by phone+IP |
| OTP send | 3/minute per phone number |
| Search | 60/minute per user/IP |
| File upload | 20/hour per user |
| Payment endpoints | 10/hour per user |

Exceeding a limit returns `429` with a `Retry-After`-equivalent message.
