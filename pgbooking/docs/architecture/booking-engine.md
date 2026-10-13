# Booking Engine Deep Dive

## State Machine

```
                  ┌─────────┐
        initiate  │         │  payment success
       ┌─────────▶│ PENDING │─────────────────┐
       │          │         │                  │
       │          └────┬────┘                  ▼
       │               │ lock expires    ┌────────────┐
       │               │ (10 min)        │ CONFIRMED  │
       │               ▼                 └─────┬──────┘
       │          ┌───────────┐                │
       │          │ CANCELLED │                │ checkout
       │          └───────────┘                ▼
       │                                  ┌─────────────┐
       └──────────────cancel─────────────▶│ CHECKED_OUT │
                  (tenant or admin)        └─────────────┘
```

Beds follow a parallel state machine: `VACANT → RESERVED → OCCUPIED → VACANT`,
kept in sync with the booking state by the stored procedures in
`database/migrations/007_functions_procedures.sql`.

## The Two-Stage Lock, Step by Step

### Stage 1 — Redis Distributed Lock

```typescript
// lock.service.ts
const result = await client.set(lockKey, sessionId, 'PX', ttlMs, 'NX');
```

- `NX` — only set if the key does not already exist (atomic check-and-set)
- `PX 600000` — auto-expire after 10 minutes even if the process crashes
  before explicitly releasing it
- Retries with exponential backoff (`BOOKING_LOCK_RETRY_COUNT`,
  `BOOKING_LOCK_RETRY_DELAY_MS`) to absorb brief contention, then fails fast
  with `409 BED_ALREADY_RESERVED`

Release uses a Lua script for an atomic compare-and-delete, so a process can
never accidentally release a lock it doesn't own:

```lua
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
```

### Stage 2 — PostgreSQL Row Lock

```sql
SELECT id, status FROM beds WHERE id = $1 FOR UPDATE NOWAIT;
-- application verifies status = 'VACANT'
UPDATE beds SET current_occupancy_status = 'RESERVED' WHERE id = $1;
INSERT INTO bookings (...) VALUES (...);
COMMIT;
```

`NOWAIT` makes the row lock fail immediately rather than queueing, since the
Redis lock should have already filtered out concurrent attempts — if we ever
reach a `FOR UPDATE` conflict here, something unexpected is happening and we
want to surface it fast rather than let requests pile up waiting.

This entire sequence is wrapped in `initialize_booking_transaction(...)`, a
single stored procedure, so the read-check-write is atomic at the database
level even if the application crashes mid-request.

## Idempotency

Every booking accepts an `X-Idempotency-Key` header (or auto-generates one
server-side). If a client retries a request — e.g. due to a network timeout
on a request that actually succeeded — the second call finds the existing
`bookings` row by `idempotency_key` and returns the same booking rather than
creating a duplicate or erroring.

## Automatic Reservation Expiry

When a booking is initiated, a delayed BullMQ job is scheduled:

```typescript
await scheduleReservationRelease(
  { bookingId, bedId, lockKey },
  env.BOOKING_LOCK_TTL_MS, // 600000ms = 10 min
);
```

The job is keyed by `release:booking:{bookingId}` so it's automatically
deduplicated — if the booking is confirmed before the delay elapses, the
worker calls `cancelReservationRelease(bookingId)` to remove the pending job.

If the job *does* fire (payment never completed), the worker calls
`release_expired_reservation(bookingId)`, which:
1. Re-checks the booking is still `PENDING` (it might have been confirmed in
   the same instant the job fired — handles the race explicitly)
2. Sets the bed back to `VACANT`
3. Marks the booking `CANCELLED` with reason `RESERVATION_EXPIRED`
4. Emits a Socket.IO event to the client so the UI can show the inline
   "reservation expired" banner specified in the UX brief, rather than a
   generic error

## Tested Failure Modes

The race-condition test suite
(`apps/backend/tests/integration/api/booking.race.test.ts`) explicitly
verifies:

| Scenario | Expected outcome |
|---|---|
| 5 users hit the same bed simultaneously | Exactly 1 succeeds, 4 get `409`/`400` |
| 10 users hit the same bed simultaneously | Exactly 1 succeeds |
| Same idempotency key sent twice concurrently | Both calls return the same booking ID |
| Reservation lock expires, then a new user books | Second booking succeeds |
| Lock TTL test against real Redis | Lock auto-expires after configured TTL |
