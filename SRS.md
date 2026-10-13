# Software Requirements Specification (SRS)

## Standard: IEEE Std 830-1998 Conforming Specification
**Project:** NextGen PG and Co-Living Booking Ecosystem  
**Document Reference:** SRS-NEXTGEN-2026-V1  
**Date:** October 2026  

---

## 1. Introduction

### 1.1 Purpose
This document specifies the software requirements for the NextGen PG Booking Platform. It outlines the functional behavior, performance constraints, external interfaces, and security attributes of both the web client application and the API backend service.

### 1.2 Scope of the Software
The software comprises:
- An auto-adaptive frontend Single Page Application (SPA) built with React 18.
- An asynchronous RESTful API backend developed with FastAPI and Python 3.11+.
- A database storage abstraction supporting MongoDB Atlas document models with local in-memory fallback.
- An enterprise reference architecture for PostgreSQL 16 and React Native mobile deployment.

The platform provides student and professional accommodation discovery, real-time bed locking, escrowed deposit payments, property management, and automated cancellation processing for Jaipur, Neemrana, Behror, and Kotputli.

### 1.3 Definitions, Acronyms, and Abbreviations
- API: Application Programming Interface
- ASGI: Asynchronous Server Gateway Interface
- CORS: Cross-Origin Resource Sharing
- JWT: JSON Web Token
- KYC: Know Your Customer
- NCR: National Capital Region (India)
- PG: Paying Guest (Shared residential accommodation)
- ReDoS: Regular Expression Denial of Service
- SPA: Single Page Application
- SRV: DNS Service Record (MongoDB Atlas Connection Strings)
- TTL: Time To Live
- URI: Uniform Resource Identifier

### 1.4 References
- IEEE Std 830-1998 Recommended Practice for Software Requirements Specifications
- RFC 7519: JSON Web Token (JWT)
- W3C Web Content Accessibility Guidelines (WCAG) 2.1 Level AA
- Stripe API Specification Version 2024-06-20

---

## 2. Overall Description

### 2.1 Product Perspective
NextGen PG is a distributed, web-centric multi-tenant application. The backend runs as a containerized web service communicating asynchronously with MongoDB Atlas. Third-party integrations include Stripe (Payment Processing), SendGrid (Transactional Notifications), and external CDNs for static media delivery.

### 2.2 Product Functions
1. User Authentication and Identity (Role: Tenant vs Owner).
2. Property and Inventory Catalog with Geo-Categorization.
3. Bed-Level State Transitions (Vacant -> Locked -> Occupied -> Vacant).
4. Automated 10-Minute Bed Reservation Expiration.
5. Escrow Token Deposit Calculation and Payment Verification.
6. Owner Listing Creation, Room Structuring, and 30-Day Boost Upgrades.
7. Automated Tenant Booking Voucher Issuance and Cancellation Refunds.
8. AI-Powered Natural Language Room Matching Assistant.
9. Dynamic XML Sitemap and Crawler Indexing.

### 2.3 User Characteristics
- Tenant Users: Varying technical literacy; primarily accessing via mobile 4G/5G connections; need immediate verification and frictionless checkout.
- Property Owner Users: Commercial landlords needing straightforward inventory and rent status overviews across multiple rooms.
- System Administrators: Manage platform integrity, audit logs, and infrastructure monitors.

### 2.4 Operating Environment
- Client Browsers: Chrome 100+, Safari 15+, Firefox 100+, Edge 100+ on iOS, Android, macOS, and Windows.
- Server Runtime: Python 3.11+ / Uvicorn under Linux/Debian or container environments (Render / Docker).
- Database Environment: MongoDB 6.0+ / MongoDB Atlas M0 Free Cluster.

### 2.5 Design and Implementation Constraints
- Backend framework must remain pure asynchronous Python (FastAPI / Motor).
- Zero non-essential heavy dependencies (no external ML frameworks or blockchain packages).
- In-memory mock database fallback must operate out-of-the-box when external MongoDB connection is unavailable.
- Storage cap of 5 megabytes per uploaded document with strict magic-byte validation.

---

## 3. Specific Requirements

### 3.1 External Interface Requirements

#### 3.1.1 User Interfaces
- Responsive Auto-Adaptive Layout conforming to viewport classes:
  - Mobile: Width <= 640px.
  - Tablet: 641px <= Width <= 1024px.
  - Monitor / Desktop: Width > 1024px.
- Dark mode aesthetic utilizing curated CSS custom properties (--bg-main: #0b0f19, --bg-card: rgba(17, 24, 39, 0.75)).
- Contrast ratio exceeding 4.5:1 for standard text and 3:1 for large headings.

#### 3.1.2 Software Interfaces
- MongoDB Motor 3.4+ driver utilizing dnspython for mongodb+srv:// resolution.
- Stripe REST API for Checkout Session generation and webhook verification.
- SendGrid v3 Web API for SMTP-free transactional email dispatch.

#### 3.1.3 Communication Protocols
- HTTPS (TLS 1.3 preferred, TLS 1.2 minimum) for all production client-server data transfer.
- JSON data serialization over HTTP/2 and HTTP/1.1.

### 3.2 System Features and Functional Behavior

#### 3.2.1 Real-Time Bed Locking
- Stimulus: Authenticated tenant issues POST /api/bookings/lock with property_id, room_id, and bed_id.
- Validation:
  - Check user authentication token.
  - Verify property, room, and bed exist in database.
  - Check if bed status is 'vacant' or has an expired locked_until timestamp.
- Action:
  - Atomically update bed status to 'locked'.
  - Set locked_by to user identifier.
  - Set locked_until to current UTC timestamp + 10 minutes.
- Response: HTTP 200 with booking session identifier and seconds remaining.

#### 3.2.2 Bed Lock Expiration Cleanup
- Stimulus: Any query requesting property or room availability.
- Processing: Database query compares bed locked_until with current UTC time. If locked_until < now, bed status is evaluated as vacant.

#### 3.2.3 Token Payment and Occupancy Confirmation
- Stimulus: Stripe webhook payload or verified client confirmation.
- Processing:
  - Verify booking record is currently in locked status.
  - Calculate token deposit amount (Rent * Token Deposit Fraction).
  - Update bed status to 'occupied'.
  - Transition booking record to 'confirmed'.
  - Dispatch confirmation voucher via SendGrid.
- Response: HTTP 200 with confirmed booking payload.

#### 3.2.4 Cancellation and Grace Period Refund
- Stimulus: POST /api/bookings/{booking_id}/cancel.
- Processing:
  - Calculate elapsed time between booking confirmation and cancellation.
  - If elapsed days <= CANCEL_GRACE_DAYS (2 days): Refund 100 percent of token deposit.
  - If elapsed days > CANCEL_GRACE_DAYS: Refund 80 percent of token deposit.
  - Unlock bed status to 'vacant'.
- Response: HTTP 200 with refund amount and cancellation summary.

### 3.3 Security Requirements
- SR-01: Passwords must be hashed using bcrypt with salt rounds >= 12 before persistence.
- SR-02: Endpoint rate limiting on /auth/login (maximum 5 failed attempts per IP per 5 minutes).
- SR-03: Security headers must accompany all responses:
  - X-Content-Type-Options: nosniff
  - X-Frame-Options: DENY
  - X-XSS-Protection: 1; mode=block
- SR-04: File upload verification must check magic-byte signatures (JPEG, PNG, WEBP) and reject executable extensions.
- SR-05: JSON-LD structured data on frontend must sanitize closing script tags to prevent DOM-based XSS injection.

### 3.4 Performance Requirements
- PR-01: Database read operations for property search shall complete within 50 milliseconds.
- PR-02: Peak simultaneous locking throughput shall sustain 500 requests per second with zero duplicate assignments.
- PR-03: Frontend static asset bundle must not exceed 350 KB gzipped.
