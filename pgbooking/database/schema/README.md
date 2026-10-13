# Database Schema Reference

PostgreSQL 16 + PostGIS 3.4 · 3NF Compliant · UUID Primary Keys

## Entity Relationship Overview

```
users (1) ──┬──< properties (landlord_owner_id)
            ├──< bookings (tenant_user_id)
            ├──< payments (payer_user_id)
            ├──< kyc_documents (user_id)
            ├──< maintenance_tickets (reported_by_user_id)
            ├──< refresh_tokens (user_id)
            ├──< notifications (user_id)
            ├──< favorites (user_id)
            └──< reviews (reviewer_id)

properties (1) ──< rooms (property_parent_id) ──< beds (room_parent_id)
properties (1) ──< property_photos (property_id)
properties (1) ──< favorites (property_id)
properties (1) ──< reviews (property_id)

beds (1) ──< bookings (assigned_bed_id)

bookings (1) ──< payments (booking_context_id)
bookings (1) ──< maintenance_tickets (booking_id)
bookings (1) ──< reviews (booking_id) [1:1]

maintenance_tickets (1) ──< maintenance_comments (ticket_id)
```

## Table Reference

| Table | Purpose | Key Constraints |
|---|---|---|
| `users` | All accounts (TENANT/OWNER/SYSTEM_ADMIN) | UNIQUE(phone_number) |
| `otp_logs` | OTP attempt + lockout tracking | One active OTP per phone (partial unique index) |
| `refresh_tokens` | JWT refresh token rotation | UNIQUE(token_hash), indexed by token_family |
| `properties` | PG/co-living listings | GiST spatial index on geo_coordinate_point |
| `property_photos` | S3-backed photo gallery | One cover photo per property (partial unique index) |
| `rooms` | Room-level pricing & sharing config | token_deposit_amount = 20% of security_deposit (generated column) |
| `beds` | Individual bed inventory | UNIQUE(room_parent_id, bed_spatial_code) |
| `bookings` | Central booking ledger | UNIQUE(idempotency_key) |
| `payments` | Immutable financial audit log | UNIQUE(idempotency_key), UNIQUE(payment_gateway_order_id) |
| `kyc_documents` | Identity verification docs | Encrypted document_number |
| `maintenance_tickets` | Tenant-reported issues | CHECK(priority BETWEEN 1 AND 5) |
| `maintenance_comments` | Ticket discussion thread | is_internal flag hides owner-only notes |
| `notifications` | In-app/push/email/SMS log | Partial index on unread |
| `favorites` | Tenant saved properties | UNIQUE(user_id, property_id) |
| `reviews` | Post-stay ratings | UNIQUE(booking_id) — one review per booking |
| `audit_logs` | Append-only write audit trail | Never updated or deleted |

## Key Design Decisions

**Token deposit is a generated column.** `rooms.token_deposit_amount` is computed
as `required_security_deposit_amount * 0.20` directly in PostgreSQL (`GENERATED
ALWAYS AS ... STORED`), so the 20% rule from the PRD is enforced at the database
layer — it can't drift even if application code changes.

**Bed counters are denormalized via triggers.** `properties.total_beds` and
`properties.vacant_beds` are updated automatically whenever a row in `beds`
changes status. This avoids a `COUNT(*) ... GROUP BY` on every search query,
which is critical for the <200ms PostGIS search SLO.

**Soft deletes everywhere user-facing.** `users`, `properties`, and `bookings`
all carry a `deleted_at` timestamp instead of being physically deleted, to
preserve referential integrity for historical payments and audit logs.

**Money fields use `NUMERIC(12,2)`** — never floating point — to avoid rounding
errors in financial calculations.

## Stored Procedures

| Function | Purpose |
|---|---|
| `search_properties_in_radius(...)` | PostGIS `ST_DWithin` radius search with filters |
| `initialize_booking_transaction(...)` | Atomic bed reservation (`SELECT ... FOR UPDATE`) |
| `confirm_booking_after_payment(...)` | Transitions PENDING → CONFIRMED after payment |
| `release_expired_reservation(...)` | Releases bed back to VACANT after 10-min lock expiry |
| `cancel_booking(...)` | Cancels booking and releases bed |
| `update_property_bed_counters(...)` | Recalculates denormalized bed counts |

## Indexing Strategy

- **Geospatial**: `GIST` index on `properties.geo_coordinate_point` for sub-200ms radius search
- **Text search**: `GIN` trigram indexes on property/user name fields for fuzzy search
- **Operational**: composite indexes on `(room_parent_id, current_occupancy_status)` for bed availability lookups
- **Partial indexes**: used extensively to keep indexes small (e.g. only index `WHERE deleted_at IS NULL`)

See `database/migrations/` for full DDL with inline comments on every index.
