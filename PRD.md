# Product Requirements Document (PRD)

## Project: NextGen PG and Co-Living Booking Platform
**Version:** 1.0.0  
**Target Markets:** Jaipur, Neemrana, Behror, Kotputli  
**Status:** Approved for Implementation  

---

## 1. Product Vision

To build the most reliable, transparent, and frictionless student and working-professional accommodation marketplace in Rajasthan and NCR, establishing trust through real-time bed-level reservation locking, verified pricing, zero brokerage, and automated deposit refund enforcement.

---

## 2. Target Personas

### Persona 1: The College Student (Aman Verma, Age 19)
- Profile: First-year engineering student moving to Jaipur/Kotputli for college.
- Goals: Affordable shared accommodation (INR 4,500 - 7,000/month), Wi-Fi, hygienic food, zero brokerage fee, safe environment.
- Pain Points: Fear of paying money for beds already taken, fraudulent brokers, loss of admission deposit.

### Persona 2: The Industrial Professional (Vikram Gurjar, Age 27)
- Profile: Production engineer working in Neemrana Japanese Industrial Zone / Behror RIICO.
- Goals: Single AC room, quiet study/work space, power backup, flexible cancellation policy, parking.
- Pain Points: Unclear house rules, sudden rent hikes, difficulty searching local accommodations remotely.

### Persona 3: The PG Property Owner (Manoj Kumar, Age 48)
- Profile: Owns a 24-bed residential building in Jaipur Malviya Nagar.
- Goals: High year-round occupancy, timely deposit collection, verified tenant KYC records, enhanced listing visibility.
- Pain Points: Manual register bookkeeping, payment defaults, empty beds between college semesters.

---

## 3. User Journeys and Workflows

### Journey 1: Tenant Discovery to Bed Lock and Confirmation
1. Tenant visits homepage, filters by city (e.g. Jaipur) and gender (e.g. Male).
2. Tenant reviews search results and selects a property.
3. System loads photo gallery, amenities, house rules, and room tabs.
4. Tenant selects room type (e.g. Double Sharing Standard) and clicks an available bed (e.g. Bed 101-A).
5. Tenant clicks Lock Bed. The system atomically transitions bed status to 'locked' with a 10-minute expiration window.
6. Tenant reviews token deposit amount (20 percent of monthly rent) and proceeds to payment.
7. Upon successful payment verification, bed transitions to 'occupied' and booking voucher is issued.

### Journey 2: Host Listing Creation and Visibility Boost
1. Host logs into Owner Portal.
2. Host clicks Add New Property and submits property title, city, address, monthly rent start, rules, and images.
3. Host defines rooms, occupancy sharing (1, 2, 3), and bed codes.
4. Host clicks Boost Property to purchase a 30-day prominence boost for INR 499.
5. System displays the property with priority badges across search and city landing pages.

### Journey 3: Cancellation and Refund Processing
1. Tenant opens Tenant Dashboard and views active bookings.
2. Tenant submits a cancellation request before check-in date.
3. System evaluates cancellation timing:
   - If canceled within 2 days (grace period): 100 percent refund of token deposit is credited.
   - If canceled after 2 days: 80 percent refund is credited (20 percent retained as host cancellation fee).
4. System automatically unlocks the assigned bed back to 'vacant'.

---

## 4. Functional Requirements

### FR-01: Authentication and Role-Based Access Control
- The system shall provide email and password authentication for two user roles: Tenant and Owner.
- Passwords must be hashed using bcrypt with salt rounds >= 12.
- Session authorization shall use stateless JSON Web Tokens (JWT) using HS256 algorithm with 24-hour expiration.
- Password recovery must provide a secure token reset flow without exposing reset links in server logs.

### FR-02: Property Catalog and Search Engine
- The system shall index properties across four specific cities: Jaipur, Neemrana, Behror, and Kotputli.
- Users shall be able to filter by city, gender suitability (Boys, Girls, Co-Ed), room sharing (Single, Double, Triple), and text queries.
- Boosted properties must appear first in search results with featured indicators.
- Regex search queries must be sanitized against Regular Expression Denial of Service (ReDoS) attacks.

### FR-03: Real-Time Bed Locking Engine
- Each room shall contain granular beds with individual status: 'vacant', 'locked', or 'occupied'.
- When a user locks a bed, the backend must atomically set the lock timestamp and locked_until deadline (current time + 10 minutes).
- Expired locks must be automatically treated as vacant upon subsequent queries without manual cron overhead.
- A bed must not be lockable by a user if an active non-expired lock exists for another user.

### FR-04: Payment and Deposit Escrow
- The token deposit must calculate as exactly 20 percent (or property token deposit fraction) of monthly room rent.
- Payments must support card and UPI checkout redirects via Stripe or simulated test environments.
- Webhook callbacks must be idempotent, validating transaction signatures before transitioning bed status to occupied.

### FR-05: AI Accommodation Assistant
- The system shall include an embedded AI assistant modal capable of processing natural language queries.
- Assistant must parse constraints such as budget maximums, city preference, and nearby landmarks to return matched property IDs.

### FR-06: SEO and Search Engine Discovery
- Each city must have a dedicated pre-rendered landing page at /cities/:cityId.
- Property detail pages must inject sanitized JSON-LD schema (LodgingBusiness) with script tag escape sanitization.
- The system must expose dynamic /api/sitemap.xml and /api/robots.txt endpoints.

### FR-07: Auto-Adaptive Multi-Screen UI
- The user interface must automatically adapt layout structures across:
  - Mobile Phones (< 640px): Stacked forms, touch-friendly 44px tap targets, hamburger navigation drawer, and sticky bottom booking bar.
  - Tablets (641px - 1024px): 2-column card grids and fluid search controls.
  - Monitors and Laptops (> 1024px): 3 to 4 column card grids, multi-image gallery split, and sticky desktop booking sidebar.

---

## 5. Non-Functional Requirements

- NFR-01 (Performance): Initial page load bundle under 300 KB compressed; API endpoints respond in under 150ms at 95th percentile.
- NFR-02 (Reliability): 99.9 percent uptime during college admission seasons (June through September).
- NFR-03 (Security): Enforce HTTP security headers (nosniff, DENY, XSS protection); file upload validation checking file magic-bytes and 5MB size ceiling.
- NFR-04 (Maintainability): Zero external state required for development testing via built-in in-memory document store.
