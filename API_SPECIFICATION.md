# REST API Specification Reference

## Project: NextGen PG and Co-Living Booking Platform
**Base URL (Local):** `http://localhost:8001/api`  
**Base URL (Production):** `https://pgbooking-api.onrender.com/api`  
**Protocol:** HTTPS / JSON REST  
**Authentication Scheme:** `Authorization: Bearer <jwt_token>`  
**Date:** October 2026  

---

## 1. Authentication and User Profile API (`/api/auth`)

### 1.1 Register New Account
- Endpoint: `POST /api/auth/register`
- Rate Limit: 10 requests / minute / IP
- Request Body:
```json
{
  "email": "student@example.com",
  "password": "SecurePassword123",
  "full_name": "Aman Verma",
  "phone": "+91 98765 43210",
  "role": "tenant"
}
```
- Success Response (HTTP 201 Created):
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsIn...",
  "token_type": "bearer",
  "user": {
    "_id": "user-uuid-1",
    "email": "student@example.com",
    "full_name": "Aman Verma",
    "phone": "+91 98765 43210",
    "role": "tenant"
  }
}
```

---

### 1.2 User Login
- Endpoint: `POST /api/auth/login`
- Rate Limit: 5 failed attempts per 5 minutes per IP
- Request Body:
```json
{
  "email": "student@example.com",
  "password": "SecurePassword123"
}
```
- Success Response (HTTP 200 OK): Returns JWT access token and user profile object.
- Error Response (HTTP 401 Unauthorized): Invalid email or password.
- Error Response (HTTP 429 Too Many Requests): Rate limit exceeded.

---

### 1.3 Request Password Reset Link
- Endpoint: `POST /api/auth/forgot-password`
- Rate Limit: 3 requests per 15 minutes per IP
- Request Body:
```json
{
  "email": "student@example.com"
}
```
- Success Response (HTTP 200 OK):
```json
{
  "message": "If the account exists, a password reset link has been dispatched to your email."
}
```

---

### 1.4 Get Current User Profile
- Endpoint: `GET /api/auth/me`
- Headers: `Authorization: Bearer <token>`
- Success Response (HTTP 200 OK): User details without password hash.

---

## 2. Properties and Inventory API (`/api/properties`)

### 2.1 List and Search Properties
- Endpoint: `GET /api/properties`
- Query Parameters:
  - `city` (string, optional): `"jaipur"`, `"neemrana"`, `"behror"`, `"kotputli"`
  - `gender` (string, optional): `"male"`, `"female"`, `"co-ed"`
  - `sharing` (integer, optional): `1`, `2`, `3`
  - `q` (string, optional): Search keyword (capped at 100 characters, ReDoS sanitized)
  - `limit` (integer, default: 20)
  - `skip` (integer, default: 0)
- Success Response (HTTP 200 OK):
```json
[
  {
    "_id": "prop-jai-01",
    "title": "Stanza Living & Student Hub Malviya",
    "city": "jaipur",
    "area": "Malviya Nagar",
    "address": "B-42 Siddharth Nagar, Jaipur",
    "gender": "male",
    "monthly_rent_start": 6500,
    "security_deposit": 7000,
    "token_deposit_fraction": 0.2,
    "is_boosted": true,
    "rating": 4.9,
    "reviews_count": 52,
    "amenities": ["Wi-Fi", "Food", "Power Backup"],
    "cover_image": "https://images.unsplash.com/...",
    "rooms_count": 4,
    "vacant_beds": 6
  }
]
```

---

### 2.2 Get Property Detail by ID
- Endpoint: `GET /api/properties/{property_id}`
- Success Response (HTTP 200 OK): Full property document including nested rooms array and real-time bed statuses.
- Error Response (HTTP 404 Not Found): Property not found.

---

### 2.3 Create Property Listing (Owner Only)
- Endpoint: `POST /api/properties`
- Headers: `Authorization: Bearer <token>` (Role: `owner`)
- Request Body: Full property schema with rooms and beds array.
- Success Response (HTTP 201 Created): Created property object.

---

### 2.4 Boost Property Visibility
- Endpoint: `POST /api/properties/{property_id}/boost`
- Headers: `Authorization: Bearer <token>` (Role: `owner`)
- Pricing: Fixed INR 499 per 30 days.
- Success Response (HTTP 200 OK):
```json
{
  "message": "Property successfully boosted for 30 days.",
  "is_boosted": true,
  "boost_expiry": "2026-11-14T01:00:00Z"
}
```

---

### 2.5 City Statistics
- Endpoint: `GET /api/properties/cities/stats`
- Success Response (HTTP 200 OK):
```json
{
  "jaipur": { "property_count": 14, "starting_price": 6500 },
  "neemrana": { "property_count": 8, "starting_price": 7500 },
  "behror": { "property_count": 6, "starting_price": 5500 },
  "kotputli": { "property_count": 5, "starting_price": 5000 }
}
```

---

## 3. Real-Time Bed Locking and Bookings API (`/api/bookings`)

### 3.1 Lock a Bed for 10 Minutes
- Endpoint: `POST /api/bookings/lock`
- Headers: `Authorization: Bearer <token>`
- Request Body:
```json
{
  "property_id": "prop-jai-01",
  "room_id": "room-101",
  "bed_id": "bed-101-A"
}
```
- Success Response (HTTP 200 OK):
```json
{
  "status": "locked",
  "bed_id": "bed-101-A",
  "locked_until": "2026-10-14T01:10:00Z",
  "seconds_remaining": 600,
  "message": "Bed locked for 10 minutes. Complete checkout to secure."
}
```
- Error Response (HTTP 409 Conflict): Bed is currently locked or occupied by another tenant.

---

### 3.2 Unlock Bed Early
- Endpoint: `POST /api/bookings/unlock`
- Headers: `Authorization: Bearer <token>`
- Request Body:
```json
{
  "property_id": "prop-jai-01",
  "room_id": "room-101",
  "bed_id": "bed-101-A"
}
```
- Success Response (HTTP 200 OK):
```json
{
  "status": "vacant",
  "message": "Bed lock released successfully."
}
```

---

### 3.3 Initiate Booking Order
- Endpoint: `POST /api/bookings/initiate`
- Headers: `Authorization: Bearer <token>`
- Request Body:
```json
{
  "property_id": "prop-jai-01",
  "room_id": "room-101",
  "bed_id": "bed-101-A",
  "check_in_date": "2026-11-01"
}
```
- Success Response (HTTP 201 Created):
```json
{
  "_id": "book-9872134",
  "status": "initiated",
  "monthly_rent": 7500,
  "token_amount": 1500,
  "check_in_date": "2026-11-01"
}
```

---

### 3.4 List Tenant Bookings
- Endpoint: `GET /api/bookings/my-bookings`
- Headers: `Authorization: Bearer <token>`
- Success Response (HTTP 200 OK): Array of tenant booking records.

---

### 3.5 Cancel Booking and Calculate Refund
- Endpoint: `POST /api/bookings/{booking_id}/cancel`
- Headers: `Authorization: Bearer <token>`
- Success Response (HTTP 200 OK):
```json
{
  "booking_id": "book-9872134",
  "status": "cancelled",
  "refund_amount": 1500,
  "refund_fraction": 1.0,
  "message": "Cancelled within 2-day grace period. 100% token refund issued."
}
```

---

## 4. Payments API (`/api/payments`)

### 4.1 Create Stripe Checkout Session
- Endpoint: `POST /api/payments/create-checkout-session`
- Headers: `Authorization: Bearer <token>`
- Request Body:
```json
{
  "booking_id": "book-9872134",
  "origin": "https://pgbooking.vercel.app",
  "success_url": "https://pgbooking.vercel.app/booking/success?booking_id=book-9872134",
  "cancel_url": "https://pgbooking.vercel.app/properties/prop-jai-01?cancelled=1"
}
```
- Success Response (HTTP 200 OK):
```json
{
  "checkout_url": "https://checkout.stripe.com/c/pay/cs_test_...",
  "session_id": "cs_test_..."
}
```

---

### 4.2 Simulated Payment Confirmation (Testing Fallback)
- Endpoint: `POST /api/payments/confirm-simulated`
- Headers: `Authorization: Bearer <token>`
- Request Body: `{ "booking_id": "book-9872134" }`
- Success Response (HTTP 200 OK): Transitions bed to 'occupied' and booking to 'confirmed'.

---

### 4.3 Stripe Webhook Ingress
- Endpoint: `POST /api/payments/webhook`
- Headers: `Stripe-Signature: t=1612...,v1=...`
- Payload: Raw binary Stripe event JSON.
- Processing: Validates HMAC signature; activates booking upon `checkout.session.completed`.

---

## 5. AI Assistant API (`/api/ai`)

### 5.1 AI Accommodation Matcher
- Endpoint: `POST /api/ai/match`
- Request Body:
```json
{
  "query": "Looking for a single room in Jaipur under 8000 near MNIT with food"
}
```
- Success Response (HTTP 200 OK):
```json
{
  "recommendations": [
    {
      "property_id": "prop-jai-01",
      "title": "Stanza Living & Student Hub Malviya",
      "matched_reason": "Single AC room available for 7,500 INR, includes 3 meals, located 5 mins from MNIT."
    }
  ]
}
```

---

## 6. Secure Media Upload API (`/api/uploads`)

### 6.1 Upload Document or Image
- Endpoint: `POST /api/uploads`
- Headers: `Authorization: Bearer <token>`, `Content-Type: multipart/form-data`
- Payload: `file: <binary_image_data>` (JPEG, PNG, WebP only, <= 5 MB)
- Success Response (HTTP 201 Created):
```json
{
  "url": "/uploads/a7b8c9d0-1234-5678-9abc-def012345678.jpg",
  "filename": "a7b8c9d0-1234-5678-9abc-def012345678.jpg",
  "size_bytes": 1048576
}
```

---

## 7. System Health and SEO Endpoints

### 7.1 Health Check
- Endpoint: `GET /health` or `GET /api/health`
- Success Response (HTTP 200 OK):
```json
{
  "status": "PASS",
  "app_name": "NextGen PG Booking API",
  "environment": "production",
  "port": 8001,
  "uptime_seconds": 3600,
  "database": {
    "type": "mongodb",
    "connected": true
  },
  "checks": {
    "no_hardcoded_secrets": true,
    "cors_configured": true,
    "rate_limiting_active": true,
    "redos_protection_active": true
  }
}
```

### 7.2 Dynamic XML Sitemap
- Endpoint: `GET /api/sitemap.xml`
- Output: Valid XML standard crawler sitemap indexing `/` and all `/cities/*` landing pages.
