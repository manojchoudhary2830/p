# NextGen PG Booking Platform — Jaipur, Neemrana, Behror & Kotputli

A modern, production-ready PG and Room Booking web application engineered with a **FastAPI (Python) backend** and a **React (Vite) frontend**, built according to the specifications and security audit hardening documented in `p.md`.

---

## 🌟 Key Features & Geographic Coverage

- **Target Locations:**
  - **Jaipur:** MNIT Malviya Nagar, World Trade Park, Sitapura Industrial & IT Corridor.
  - **Neemrana:** RIICO Japanese Industrial Zone, Havells & Daikin Industrial Parks.
  - **Behror:** NH-48 Golden Corridor & Government College hub.
  - **Kotputli:** LBS College & Industrial Cement manufacturing belt.
- **Two-Stage Bed Reservation Engine:**
  - Real-time bed status (`Vacant`, `Locked`, `Occupied`).
  - **10-Minute Lock TTL (`BED_LOCK_TTL_MIN=10`):** Prevents double-booking during checkout with live countdown timer.
- **Financial & Refund Business Rules:**
  - **Token Deposit:** 20% token deposit calculated on reservation.
  - **Grace Period (`CANCEL_GRACE_DAYS=2`):** 100% full refund on cancellation within 2 days.
  - **Cancellation Refund (`CANCEL_REFUND_FRACTION_AFTER_CONFIRM=0.8`):** Automated 80% refund after grace period.
  - **Property Boost (`BOOST_PRICE_INR=499`):** 30-day top-tier listing boost for PG owners.
- **AI Recommendation Assistant:**
  - Smart natural-language assistant powered by `EMERGENT_LLM_KEY` recommending verified residences based on college, company, or budget.

---

## 🔒 Security Audit Implementation (Resolved from `p.md`)

| Vulnerability / Task Flagged in `p.md` | Location | Implementation & Resolution |
|---|---|---|
| **1. Rate Limiting on Login & Password Reset** (Lines 74–91) | [backend/app/ratelimit.py](file:///c:/Users/manoj/Downloads/p/p/backend/app/ratelimit.py) | Sliding-window token bucket rate limiter (5 attempts/min on `/auth/login`; 3 attempts/10min on `/auth/forgot-password`). Password reset links are strictly omitted from terminal and log outputs. |
| **2. ReDoS (Regular Expression Denial of Service)** (Lines 92–100) | [backend/app/routes/properties.py](file:///c:/Users/manoj/Downloads/p/p/backend/app/routes/properties.py) | All user search strings are escaped using `re.escape()` before executing MongoDB pattern matches, preventing catastrophic backtracking. |
| **3. File Upload Hardening** (Lines 102–106) | [backend/app/routes/uploads.py](file:///c:/Users/manoj/Downloads/p/p/backend/app/routes/uploads.py) | Restricts uploads to verified MIME types (`JPEG`, `PNG`, `WEBP`) with magic-byte signature validation, 5MB file cap, and serves files with the `X-Content-Type-Options: nosniff` header. |
| **4. Refund Race Condition & Retry Restriction** (Lines 108–118) | [backend/app/routes/bookings.py](file:///c:/Users/manoj/Downloads/p/p/backend/app/routes/bookings.py) | Atomic lock transitions with idempotency keys. Retries are strictly restricted to `refund_failed` only (duplicate attempts on `refund_pending` or `refunded` are rejected with HTTP 400/409). |
| **5. Cross-Site Scripting (XSS) in JSON-LD** (Lines 120–131) | [frontend/src/lib/seo.js](file:///c:/Users/manoj/Downloads/p/p/frontend/src/lib/seo.js) | Implemented `escapeJsonLd()` which escapes `</` to `<\/`, neutralizing closing tag breakout attacks in structured data blocks. |
| **6. Google Search Console Sitemap & XSL Styling** (Line 36) | [backend/app/routes/seo.py](file:///c:/Users/manoj/Downloads/p/p/backend/app/routes/seo.py) | Dynamic `/api/sitemap.xml` with Priority URLs and an XSL stylesheet (`/api/sitemap.xsl`) providing a visual UI in web browsers while maintaining schema compliance. |

---

## 🚀 Quick Start (Local Run)

### 1. Launch with 1-Click Script (Windows)
Double-click `run.bat` or run:
```bash
.\run.bat
```

### 2. Manual Start

**Backend:**
```bash
cd backend
.\venv\Scripts\python server.py
# Backend runs on http://localhost:8001 (API docs at http://localhost:8001/docs)
```

**Frontend:**
```bash
cd frontend
npm run dev
# Frontend runs on http://localhost:3000
```

---

## 🧪 Running Security & Business Logic Test Suite

Run the automated test suite verifying all 5 security fixes:
```bash
cd backend
.\venv\Scripts\python test_security_suite.py
```
Outputs:
```text
=== 1. HEALTH CHECK ===
Health check PASS: {'no_hardcoded_secrets': True, 'cors_configured': True, 'rate_limiting_active': True, 'redos_protection_active': True, 'refund_race_prevention_active': True, 'safe_uploads_active': True}

=== 2. LOGIN RATE LIMITING ===
Rate limiting active: blocked with 429 (Too many attempts. Please try again in 59 seconds.)

=== 3. SITEMAP XML ===
Sitemap generated correctly with all 4 cities and properties!

=== 4. ReDoS SEARCH SANITIZATION ===
ReDoS pattern safely sanitized and handled without timeout or crash!

=== 5. BOOKING, BED LOCK & REFUND RETRY RESTRICTION ===
Bed lock acquired. TTL: 10 minutes
Booking initiated: bk-..., token deposit: INR 2000.0
Booking confirmed! Bed occupied.
Booking cancelled with eligible refund: INR 2000.0 (Status: refund_pending)
First refund processed successfully.
Duplicate refund retry prevented: 400 - Refund has already been processed successfully.

*** ALL AUDIT AND BUSINESS LOGIC TESTS PASSED SUCCESSFULLY! ***
```
