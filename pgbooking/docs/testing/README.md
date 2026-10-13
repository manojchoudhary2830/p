# Testing Strategy

## Test Pyramid

```
        ┌─────────────┐
        │  Load Tests  │   k6 — booking.load.ts
        │  (k6)        │   Run before major releases
        └─────────────┘
       ┌───────────────┐
       │  Integration   │   supertest + real Postgres/Redis
       │  Tests         │   Run in CI on every push
       └───────────────┘
      ┌─────────────────┐
      │   Unit Tests     │   jest + mocked infrastructure
      │                  │   Run on every commit (fast, <10s)
      └─────────────────┘
```

## Unit Tests

**Location**: `apps/backend/tests/unit/`
**Run**: `npm run test:unit`

All external dependencies (`@config/database`, `@config/redis`, BullMQ
queues, Twilio, S3) are mocked via `tests/fixtures/setup.ts`. These tests
verify business logic in isolation — they run in under 10 seconds with no
external services required, which is what makes them suitable to run on
every single commit.

Coverage focus:
- **Auth service**: OTP generation/verification/lockout logic, token rotation,
  crypto utility correctness (hashing, encryption round-trips, phone
  normalization)
- **Booking service**: lock acquisition/release semantics, cancel/confirm
  state transition guards, error mapping from stored procedure exceptions
- **Payment service**: HMAC signature verification (valid + tampered cases),
  webhook idempotency, duplicate-order-key handling

Coverage threshold enforced in `jest.config.ts`: 70% branches, 75%
functions/lines/statements on `src/domains/**` and `src/shared/**`.

## Integration Tests

**Location**: `apps/backend/tests/integration/`
**Run**: `npm run test:integration` (requires `docker compose up -d postgres redis`)

These tests hit a real Express app instance (`createApp()`) via `supertest`,
backed by a real PostgreSQL + PostGIS database and real Redis instance. They
verify the full request/response cycle including middleware, validation, and
actual SQL execution — not just isolated functions.

Set `SKIP_INTEGRATION=true` to skip these in environments without Docker
(they auto-skip via `describe.skip` rather than failing).

### Race Condition Tests — The Most Important Suite

`tests/integration/api/booking.race.test.ts` is the test suite that proves
the double-booking prevention actually works under real concurrent load, not
just in theory:

| Test | What it proves |
|---|---|
| 5 concurrent users → same bed | Exactly 1 booking succeeds in the database |
| 10 concurrent users → same bed | Same guarantee holds at higher concurrency |
| Idempotency key sent twice simultaneously | No duplicate booking row created |
| Booking after lock expiry | Bed becomes bookable again once released |
| Redis lock acquire/release against real Redis | Lock semantics work end-to-end, not just mocked |

These tests use `Promise.allSettled()` to fire all requests genuinely
simultaneously, then assert on the actual database row count — not on
response codes alone — because response codes could theoretically lie if
there were a bug in the locking logic that let two rows through with both
returning `201`.

### Database Constraint Tests

`tests/integration/database/db.integration.test.ts` verifies that
constraints are enforced at the database level (not just in application
code), so that even a bug in the API layer can't corrupt data:

- Unique phone number, unique bed code per room
- Foreign key enforcement (can't create a property with a non-existent owner)
- Enum constraint enforcement (`bed_status_enum`)
- Check constraints (positive rent values)
- Trigger correctness (bed counter updates when beds change status)
- **PostGIS performance gate**: radius search must complete in <200ms

## Load Tests

**Location**: `apps/backend/tests/load/booking.load.ts`
**Run**: `k6 run tests/load/booking.load.ts` (requires [k6](https://k6.io) installed)

Three scenarios run together:

1. **`search_ramp`**: ramps from 0→100 virtual users over 1.5 minutes,
   hitting `/properties/search`. Threshold: p95 < 250ms.
2. **`booking_constant`**: sustained 20 req/s against `/bookings` for 2
   minutes. Threshold: p95 < 400ms.
3. **`double_booking_spike`**: 50 virtual users simultaneously attempt to
   book the *same* bed. Threshold: at least 45/50 must be correctly rejected
   with a conflict response — this is the load-test equivalent of the
   integration race test, run at higher concurrency than Jest comfortably
   handles.

Run against staging before any release that touches the booking or payment
domains:

```bash
k6 run -e API_BASE=https://staging.pgbooking.in \
       -e TENANT_TOKEN=$STAGING_TEST_TOKEN \
       -e TARGET_BED_ID=$STAGING_TEST_BED_ID \
       tests/load/booking.load.ts
```

## CI Pipeline Test Gates

From `infrastructure/github/workflows/ci-cd.yml`:

1. **Lint & typecheck** — must pass before tests run
2. **Unit tests** — must pass with coverage report uploaded as an artifact
3. **Integration tests** — run against real `postgres:16-3.4` and `redis:7.2`
   service containers spun up by GitHub Actions; migrations are applied
   fresh before tests run
4. Only after both test jobs pass does the **Docker build** stage run
5. Staging deploy requires integration tests to have passed
6. Production deploy requires the Docker build to have succeeded (assumes
   staging has already been validated manually or via the staging pipeline)

## What's Intentionally Not Covered

- **Mobile app tests**: the React Native app has a `jest` config in
  `package.json` but no test files were written for v1 — UI testing was
  deprioritized in favor of backend correctness, given the booking engine is
  where data integrity actually matters. Adding `@testing-library/react-native`
  component tests for the booking flow screens is the natural next step.
- **End-to-end (E2E) tests**: no Detox/Appium suite exists yet. The
  integration test suite covers the API surface thoroughly enough to catch
  most regressions; E2E is recommended before scaling the team further.
