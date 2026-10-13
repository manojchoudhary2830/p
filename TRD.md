# Technical Requirements Document (TRD)

## Project: NextGen PG Booking Platform
**Document Version:** 1.0.0  
**Target Architecture:** Asynchronous Micro-Web Service & Cloud Data Layer  
**Date:** October 2026  

---

## 1. Technical Stack and Runtime Environment

| Layer | Component | Version | Rationale |
|---|---|---|---|
| Runtime | Python | 3.11+ / 3.12 | Native async performance, improved exception groups |
| Web Framework | FastAPI | >= 0.111.0 | High-performance ASGI framework with Pydantic validation |
| ASGI Server | Uvicorn (standard) | >= 0.30.0 | High-throughput uvloop and httptools implementation |
| Document Database | MongoDB Atlas | 6.0+ / M0 | Flexible JSON document hierarchy for nested Room/Bed data |
| Async DB Driver | Motor (AsyncIOMotorClient) | >= 3.4.0 | Non-blocking async I/O wrapper around PyMongo |
| SRV Resolver | dnspython | >= 2.6.0 | Resolves MongoDB Atlas SRV URI records without crashing |
| Schema Validation | Pydantic v2 | >= 2.7.0 | Rust-backed fast parsing, strict typing and email validation |
| Authentication | python-jose & passlib | >= 3.3.0 | HS256 JWT encoding, bcrypt password hashing (12 rounds) |
| Frontend Library | React | 18.3.1 | Declarative component UI, Concurrent Mode support |
| Frontend Bundler | Vite | 5.4+ | Lightning-fast HMR and optimized Rollup production builds |
| Routing | React Router DOM | 6.26.0 | Client-side routing with SPA rewrite handling |
| Icons & Visuals | Lucide React | 0.441.0 | Tree-shakeable lightweight SVG icons |

---

## 2. Concurrency and Asynchronous Event Loop Management

### 2.1 Non-Blocking Architecture
FastAPI operates on an asynchronous event loop powered by uvloop. Every I/O operation (database querying, file reading, external HTTP requests to Stripe/SendGrid) must use non-blocking async/await semantics:
- MongoDB queries execute via Motor's `await collection.find_one()`.
- HTTP client requests to third-party APIs execute via `httpx.AsyncClient`.
- File writes execute using `aiofiles`.

### 2.2 Atomic Bed Locking and Race Condition Prevention
To prevent multiple tenants from simultaneously reserving the exact same bed across concurrent HTTP requests, the platform enforces atomic document-level operations:

```python
# Atomic filter query ensuring no double-locking
filter_query = {
    "_id": property_id,
    "rooms.beds": {
        "$elemMatch": {
            "bed_id": bed_id,
            "$or": [
                {"status": "vacant"},
                {"locked_until": {"$lt": current_utc_time_iso}}
            ]
        }
    }
}

update_query = {
    "$set": {
        "rooms.$[r].beds.$[b].status": "locked",
        "rooms.$[r].beds.$[b].locked_by": user_id,
        "rooms.$[r].beds.$[b].locked_until": lock_expiry_iso
    }
}
```

If another request acquired the lock milliseconds earlier, the filter match evaluates to 0 documents modified, immediately failing with HTTP 409 Conflict without data corruption.

---

## 3. Network Ingress, CORS, and Security Middleware

### 3.1 CORS Policy Configuration
The backend accepts traffic from specified origins and dynamically validates preview domains using regular expressions in `server.py`:
- Static Origins: Configured via `CORS_ORIGINS` and `FRONTEND_URL` environment variables.
- Dynamic Preview Regex: `https://.*\.vercel\.app|https://.*\.netlify\.app|https://.*\.onrender\.com|http://localhost:\d+`.
- Middleware parameters: `allow_credentials=True`, `allow_methods=["*"]`, `allow_headers=["*"]`.

### 3.2 HTTP Security Response Headers
Every response emitted by the ASGI server passes through custom middleware enforcing:
- `X-Content-Type-Options: nosniff` (Prevents MIME-sniffing exploits).
- `X-Frame-Options: DENY` (Mitigates clickjacking attacks).
- `X-XSS-Protection: 1; mode=block` (Legacy browser XSS filter).

### 3.3 ReDoS (Regular Expression Denial of Service) Protection
Property search and text matching queries undergo input sanitization in `app/routes/properties.py`:
- Query length capped to maximum 100 characters.
- Special regex metacharacters escaped via `re.escape()`.
- User input is never injected raw into uncompiled regex constructors.

### 3.4 Rate Limiting Middleware
Sensitive authentication routes are protected by a token-bucket rate limiter (`app/ratelimit.py`):
- `/api/auth/login`: Maximum 5 attempts per IP per 5-minute sliding window.
- `/api/auth/forgot-password`: Maximum 3 requests per IP per 15-minute sliding window.
- Exceeded thresholds return HTTP 429 Too Many Requests with `Retry-After` header.

### 3.5 File Upload Quarantine Pipeline
Uploaded images (KYC documents, property photos) in `app/routes/uploads.py`:
1. MIME type validation against whitelist (`image/jpeg`, `image/png`, `image/webp`).
2. Magic-byte signature verification:
   - JPEG: `\xff\xd8\xff`
   - PNG: `\x89PNG\r\n\x1a\n`
   - WebP: `RIFF....WEBP`
3. Size constraint: Maximum 5 MB (`5 * 1024 * 1024` bytes).
4. Storage: Re-named with cryptographic UUIDv4; never saved with client-supplied filenames.

---

## 4. Multi-Screen Auto-Adaptive Layout Specifications

The web client implements an auto-adaptive design system in `frontend/src/index.css`:

### 4.1 Viewport Breakpoint Specifications
1. Mobile Form Factor (Width <= 640px):
   - Single-column card grid (`grid-template-columns: 1fr`).
   - Sticky bottom booking bar (`position: fixed; bottom: 0`).
   - Mobile hamburger slide-down drawer with full city links.
   - Minimum tap target size: 44px by 44px.

2. Tablet Form Factor (641px <= Width <= 1024px):
   - Two-column adaptive card grid (`grid-template-columns: repeat(2, 1fr)`).
   - 2x2 wrapping search input grid.
   - Stacked property detail overview with fluid padding.

3. Desktop and Large Monitors (Width > 1024px):
   - Three to four column property grid (`repeat(auto-fill, minmax(330px, 1fr))`).
   - Split detail layout (`1.8fr 1.2fr`) with sticky sidebar (`top: 90px`).
   - Multi-photo gallery grid (`2fr 1fr`, height: 380px to 440px).

---

## 5. Deployment and Cloud Hosting Topology

### 5.1 Backend (Render Web Service)
- Runtime: Python 3
- Root Directory: `backend`
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn server:app --host 0.0.0.0 --port $PORT`
- Dynamic Port: Render injects `$PORT`; `config.py` binds to this environment variable.

### 5.2 Frontend (Vercel or Netlify)
- Framework Preset: Vite
- Root Directory: `frontend`
- Build Command: `npm run build`
- Output Directory: `dist`
- Client-Side Routing: Handled by `vercel.json` rewrites and `netlify.toml` / `public/_redirects` (`/* -> /index.html 200`).
- API Targeting: Configured via `VITE_BACKEND_URL` pointing to Render API domain.

### 5.3 Database (MongoDB Atlas M0 Free Cluster)
- Storage Tier: M0 Sandbox (512 MB shared RAM, 512 MB storage).
- Network Access: Allowed from anywhere (`0.0.0.0/0`) for dynamic Render IP routing.
- Protocol: `mongodb+srv://` connection with automated SSL/TLS handshakes.
