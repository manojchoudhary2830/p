# System Architecture and Technical Blueprints

## Project: NextGen PG and Co-Living Booking Platform
**Architecture Type:** Asynchronous Micro-Web Architecture and Enterprise Reference  
**Date:** October 2026  

---

## 1. High-Level System Architecture (C4 Container View)

```mermaid
graph TD
    subgraph Client_Layer["Client Tier (Cross-Device)"]
        MobileUser["Mobile Phone User (< 640px)"]
        TabletUser["Tablet / iPad User (641-1024px)"]
        DesktopUser["Desktop / Workstation User (> 1024px)"]
    end

    subgraph CDN_Edge["CDN and Edge Hosting"]
        VercelEdge["Vercel / Netlify Edge CDN"]
        StaticAssets["React 18 SPA (HTML, CSS, JS Bundles)"]
    end

    subgraph Application_Tier["Application Tier (Render Cloud)"]
        Uvicorn["Uvicorn ASGI High-Throughput Server"]
        FastAPI["FastAPI Core Application Service"]
        CORSMw["CORS & Security Headers Middleware"]
        RateLimit["Token-Bucket Rate Limiting Engine"]
        AuthRouter["Auth Router (/api/auth)"]
        PropertyRouter["Properties Router (/api/properties)"]
        BookingRouter["Bookings Router (/api/bookings)"]
        PaymentRouter["Payments Router (/api/payments)"]
        UploadRouter["Uploads Router (/api/uploads)"]
        AIRouter["AI Assistant Router (/api/ai)"]
    end

    subgraph Data_Tier["Data and Storage Tier"]
        MongoAtlas[("MongoDB Atlas M0 Database")]
        UploadDisk["Quarantined Local Media (/uploads)"]
    end

    subgraph External_Services["Third-Party Integration Tier"]
        StripeAPI["Stripe Payments Gateway"]
        SendGridAPI["SendGrid Transactional Email"]
    end

    MobileUser -->|HTTP/HTTPS| VercelEdge
    TabletUser -->|HTTP/HTTPS| VercelEdge
    DesktopUser -->|HTTP/HTTPS| VercelEdge
    VercelEdge -->|Delivers Static Bundle| StaticAssets

    MobileUser -->|REST API /api| Uvicorn
    TabletUser -->|REST API /api| Uvicorn
    DesktopUser -->|REST API /api| Uvicorn

    Uvicorn --> CORSMw
    CORSMw --> RateLimit
    RateLimit --> FastAPI

    FastAPI --> AuthRouter
    FastAPI --> PropertyRouter
    FastAPI --> BookingRouter
    FastAPI --> PaymentRouter
    FastAPI --> UploadRouter
    FastAPI --> AIRouter

    AuthRouter -->|Async Motor Driver| MongoAtlas
    PropertyRouter -->|Async Motor Driver| MongoAtlas
    BookingRouter -->|Atomic Document Locks| MongoAtlas
    UploadRouter -->|Safe Storage| UploadDisk

    PaymentRouter -->|Create Session| StripeAPI
    StripeAPI -->|Webhook Notifications| PaymentRouter

    BookingRouter -->|Send Confirmation Vouchers| SendGridAPI
    AuthRouter -->|Password Reset Emails| SendGridAPI
```

---

## 2. Bed Reservation State Machine

```mermaid
stateDiagram-v2
    [*] --> Vacant: Property Initialized

    Vacant --> Locked: Tenant Initiates 10-Min Lock
    
    state Locked {
        [*] --> CountdownActive: Set locked_until = UTC Now + 10m
        CountdownActive --> Expired: 10 Minutes Elapse without Payment
    }

    Expired --> Vacant: Lock Evicted Automatically
    Locked --> Vacant: Tenant Manually Cancels Session

    Locked --> Occupied: Token Deposit Paid via Stripe / UPI
    
    state Occupied {
        [*] --> ConfirmedBooking: Bed Token Deposit Escrowed
        ConfirmedBooking --> CancelledWithinGrace: Cancellation <= 2 Days (100% Refund)
        ConfirmedBooking --> CancelledAfterGrace: Cancellation > 2 Days (80% Refund)
    }

    CancelledWithinGrace --> Vacant: Bed Re-enters Inventory
    CancelledAfterGrace --> Vacant: Bed Re-enters Inventory
```

---

## 3. End-to-End Payment and Booking Sequence Flow

```mermaid
sequenceDiagram
    autonumber
    actor Tenant as Tenant (Client Browser)
    participant API as FastAPI Backend (/api)
    participant DB as MongoDB Atlas
    participant Stripe as Stripe Gateway
    participant Mail as SendGrid API

    Tenant->>API: POST /api/bookings/lock (property_id, room_id, bed_id)
    API->>DB: Atomic Update: find bed where status='vacant' and set status='locked'
    DB-->>API: Match confirmed, 1 document updated
    API-->>Tenant: HTTP 200 { status: 'locked', seconds_remaining: 600 }

    Tenant->>API: POST /api/bookings/initiate (check_in_date)
    API->>DB: Create Booking Record (status: 'initiated')
    DB-->>API: Booking ID generated
    API-->>Tenant: Booking ID returned

    Tenant->>API: POST /api/payments/create-checkout-session (booking_id)
    API->>Stripe: Create Checkout Session (amount: 20% token deposit)
    Stripe-->>API: Returns checkout_url and session_id
    API-->>Tenant: { checkout_url: 'https://checkout.stripe.com/...' }

    Tenant->>Stripe: Tenant enters card or UPI details and authorizes payment
    Stripe-->>Tenant: Payment Authorized, Redirects to /booking/success

    Stripe->>API: POST /api/payments/webhook (checkout.session.completed)
    API->>API: Verify cryptographic webhook signature
    API->>DB: Update Bed: status = 'occupied'
    API->>DB: Update Booking: status = 'confirmed', payment_status = 'paid'
    API->>Mail: Send Transactional Confirmation Voucher
    Mail-->>Tenant: Email voucher delivered with check-in details
```

---

## 4. Cancellation and Refund Algorithm Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Tenant as Tenant User
    participant API as FastAPI (/api/bookings/cancel)
    participant DB as MongoDB Atlas
    participant Stripe as Stripe Refund API
    participant Mail as SendGrid Email

    Tenant->>API: POST /api/bookings/{id}/cancel
    API->>DB: Query Booking Record by ID
    DB-->>API: Booking details (created_at, token_amount, bed_id)
    
    API->>API: Calculate elapsed_days = (UTC Now - created_at)
    alt elapsed_days <= CANCEL_GRACE_DAYS (2 days)
        API->>API: Calculate refund = 100% of token_amount
    else elapsed_days > CANCEL_GRACE_DAYS
        API->>API: Calculate refund = 80% of token_amount (20% host fee retained)
    end

    API->>Stripe: Issue Stripe Refund (amount: calculated_refund)
    API->>DB: Update Booking status = 'cancelled'
    API->>DB: Update Bed status = 'vacant'
    API->>Mail: Send Cancellation and Refund Statement
    API-->>Tenant: HTTP 200 { status: 'cancelled', refund_amount: calculated_refund }
```

---

## 5. Architectural Quality Attributes

1. Reliability:
   - Database operations wrapped in defensive try/except blocks with graceful in-memory store fallbacks.
   - Idempotent Stripe webhook handling preventing duplicate credit records.

2. Scalability:
   - Stateless web workers capable of scaling horizontally across container clusters.
   - Static assets cached at global edge CDNs (Vercel/Netlify) with zero backend CPU consumption.

3. Security:
   - End-to-end token validation with HS256 HMAC cryptographic signing.
   - Zero hardcoded secrets; 100 percent dynamic environment variable binding.
   - Comprehensive input sanitization against ReDoS, SQLi, and NoSQL injection.
