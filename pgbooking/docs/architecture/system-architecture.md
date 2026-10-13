# System Architecture

## High-Level Overview

```
┌─────────────────┐     ┌─────────────────┐
│  React Native    │     │  React Native    │
│  Tenant App      │     │  Owner App       │
└────────┬─────────┘     └────────┬─────────┘
         │         HTTPS / WSS    │
         └───────────┬────────────┘
                      ▼
            ┌──────────────────┐
            │   NGINX (TLS,     │
            │   rate limiting)  │
            └─────────┬─────────┘
                      ▼
            ┌──────────────────┐
            │  Express API      │
            │  (2+ replicas)    │
            └──┬───────┬───────┬┘
               │       │       │
      ┌────────▼─┐ ┌──▼────┐ ┌▼──────────┐
      │PostgreSQL │ │ Redis │ │  BullMQ    │
      │ +PostGIS  │ │ cache/│ │  workers   │
      │           │ │ locks │ │            │
      └───────────┘ └───────┘ └─────┬──────┘
                                     │
                  ┌──────────────────┼──────────────────┐
                  ▼                  ▼                  ▼
            ┌──────────┐      ┌──────────┐      ┌──────────────┐
            │  AWS S3   │      │ Twilio   │      │  Firebase    │
            │  storage  │      │ SMS      │      │  Push (FCM)  │
            └──────────┘      └──────────┘      └──────────────┘
                                     │
                              ┌──────▼──────┐
                              │  Razorpay    │
                              │  Payments    │
                              └─────────────┘
```

## Architectural Pattern: Domain-Driven Micro-Monolith

The backend is a single deployable Express application internally organized
into independent domain modules (`src/domains/*`), each owning its own
controllers, services, repositories, routes, and validators. This was chosen
over microservices for the v1 build because:

- A single team can ship faster without distributed-systems overhead
- Domain boundaries are still enforced at the code level — each domain only
  imports from `@shared` and its own files, never reaches into another
  domain's repository directly
- Any domain can be extracted into its own service later with minimal
  refactoring, since the repository/service/controller split already exists

## Request Flow: Booking a Bed (Critical Path)

1. **Client** calls `POST /api/v1/bookings` with `bed_id`, `intended_check_in`,
   and an `X-Idempotency-Key` header.
2. **Auth middleware** verifies the JWT (RS256), checks the session blacklist
   in Redis for revoked tokens.
3. **Validation middleware** parses the body against a Zod schema.
4. **Booking service** runs the two-stage lock:
   - **Stage 1 (Redis)**: `SET lock:bed:{id} {session} NX PX 600000`. If this
     fails, another request is already mid-checkout for this bed — return
     `409` immediately without touching the database.
   - **Stage 2 (PostgreSQL)**: Opens a transaction, runs
     `SELECT ... FOR UPDATE NOWAIT` on the bed row, verifies status is
     `VACANT`, updates it to `RESERVED`, inserts the `bookings` row, commits.
5. **BullMQ** schedules a delayed job (`release-bed-lock`, 10-minute delay)
   keyed by booking ID, so if payment never completes, the bed is
   automatically released back to `VACANT`.
6. **Response** returns the booking ID, lock expiry timestamp, and the
   required token deposit amount to the client.

See `docs/architecture/booking-engine.md`-equivalent detail in
`apps/backend/src/domains/bookings/services/booking.service.ts` for the full
implementation with error mapping.

## Why Redis Lock *and* `SELECT FOR UPDATE`?

Either one alone is insufficient:

- **Redis lock only**: Redis is not the source of truth for inventory state.
  A crashed process between acquiring the lock and writing to Postgres would
  leave the bed in an inconsistent state with no DB-level guarantee.
- **`SELECT FOR UPDATE` only**: Under high concurrency, dozens of requests
  could all reach the transaction at once and queue up waiting for the row
  lock, spiking database connection usage and response latency. The Redis
  lock acts as a cheap, fast pre-filter that rejects 99% of concurrent
  duplicate attempts before they ever touch a database connection.

## Data Consistency Boundaries

| Concern | Mechanism |
|---|---|
| Double-booking | Redis `NX` lock + Postgres `FOR UPDATE` |
| Duplicate payment processing | `idempotency_key` UNIQUE constraint + webhook idempotency check |
| Duplicate booking submission | Client-supplied or server-generated idempotency key |
| Refresh token replay | Token family revocation on detected reuse |
| Concurrent profile edits | Last-write-wins (acceptable for this domain) |

## Caching Strategy

| Data | Cache | TTL | Invalidation |
|---|---|---|---|
| Property detail | Redis (DB 0) | 5 min | On property update/photo change |
| Search results | Redis (DB 0) | 1 min | Time-based only (high write volume) |
| OTP resend cooldown | Redis (DB 0) | 60s | Time-based |
| Revoked access tokens | Redis (DB 1, sessions) | Until token's natural expiry | N/A |
| Distributed locks | Redis (DB 2) | 10 min (configurable) | Released on confirm/cancel/expiry |
| BullMQ job state | Redis (DB 3) | Job-dependent | Managed by BullMQ |

Redis databases are logically separated (cache=0, sessions=1, locks=2,
queue=3) so that flushing one concern (e.g. clearing all locks during an
incident) never touches unrelated data.

## Scalability Roadmap

**Current (v1) capacity target**: 1,500 concurrent connections, <200ms search,
<400ms booking mutation — per SRS non-functional requirements.

**Horizontal scaling path**:
1. Backend is already stateless (JWT auth, no in-process session) — add
   replicas behind NGINX `least_conn` upstream.
2. PostgreSQL: read replicas for search/listing traffic once write load on
   primary becomes the bottleneck; `bookings`/`payments` stay on primary.
3. Redis: move from single-node to Redis Cluster when lock/cache throughput
   exceeds a single instance.
4. BullMQ workers: scale worker concurrency and add dedicated worker
   instances separate from the API process once queue depth grows.
5. Extract `payments` and `bookings` domains into separate services first if
   a microservices split is ever needed — they have the clearest bounded
   context and the least cross-domain coupling.
