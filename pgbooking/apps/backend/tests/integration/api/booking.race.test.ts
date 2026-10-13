/**
 * Booking Race Condition Tests
 *
 * Validates the two-stage locking mechanism (Redis + DB FOR UPDATE)
 * prevents double-booking under concurrent load.
 *
 * Run: npm run test:integration (requires postgres + redis running)
 */

import request from 'supertest';
import { Application } from 'express';
import { Pool, PoolClient } from 'pg';

const INTEGRATION_SKIP = process.env.SKIP_INTEGRATION === 'true';
const describeOrSkip = INTEGRATION_SKIP ? describe.skip : describe;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function getJwtForTestUser(
  app: Application,
  phone: string,
): Promise<string> {
  // In test environment, NODE_ENV=test bypasses Twilio and logs OTP
  await request(app).post('/api/v1/auth/otp/send').send({ phone_number: phone });

  // Fetch OTP hash directly from DB for test
  const { queryOne } = await import('../../../src/config/database');
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM otp_logs WHERE phone_number = $1 AND is_used = FALSE ORDER BY created_at DESC LIMIT 1`,
    [phone],
  );

  // Use the dev OTP (000000 in test mode with NODE_ENV=test seeded env)
  const verifyRes = await request(app)
    .post('/api/v1/auth/otp/verify')
    .send({ phone_number: phone, otp: process.env.TEST_OTP ?? '123456' });

  return verifyRes.body.data?.access_token ?? '';
}

async function resetBedStatus(pool: Pool, bedId: string): Promise<void> {
  await pool.query(
    `UPDATE beds SET current_occupancy_status = 'VACANT' WHERE id = $1`,
    [bedId],
  );
  await pool.query(
    `UPDATE bookings SET current_booking_lifecycle_state = 'CANCELLED', deleted_at = NOW()
     WHERE assigned_bed_id = $1 AND current_booking_lifecycle_state IN ('PENDING','CONFIRMED')`,
    [bedId],
  );
}

// ─────────────────────────────────────────────
// Race Condition Suite
// ─────────────────────────────────────────────

describeOrSkip('Booking Race Condition Tests', () => {
  let app: Application;
  let pool: Pool;
  const TARGET_BED_ID = '30000000-0000-0000-0000-000000000004'; // from seed data
  const CHECK_IN = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

  // Create multiple test tenant accounts
  const tenantPhones = [
    '+919000000001', '+919000000002', '+919000000003',
    '+919000000004', '+919000000005',
  ];
  let tenantTokens: string[] = [];

  beforeAll(async () => {
    if (INTEGRATION_SKIP) return;

    process.env.NODE_ENV = 'test';

    const { createApp } = await import('../../../src/app');
    const { connectDatabase, getPool } = await import('../../../src/config/database');
    const { connectRedis } = await import('../../../src/config/redis');

    await connectDatabase();
    await connectRedis();
    pool = getPool();
    app = createApp();

    // Provision test tenants (upsert)
    for (const phone of tenantPhones) {
      await pool.query(
        `INSERT INTO users (phone_number, legal_full_name, account_role, identity_kyc_status)
         VALUES ($1, 'Race Test User', 'TENANT', 'VERIFIED')
         ON CONFLICT (phone_number) DO UPDATE SET identity_kyc_status = 'VERIFIED'`,
        [phone],
      );
    }

    tenantTokens = await Promise.all(
      tenantPhones.map((p) => getJwtForTestUser(app, p)),
    );
  });

  beforeEach(async () => {
    if (INTEGRATION_SKIP) return;
    await resetBedStatus(pool, TARGET_BED_ID);
    // Flush Redis lock DB to clear any stale locks
    const { getLockClient } = await import('../../../src/config/redis');
    await getLockClient().flushdb();
  });

  afterAll(async () => {
    if (INTEGRATION_SKIP) return;
    await resetBedStatus(pool, TARGET_BED_ID);
    const { disconnectDatabase } = await import('../../../src/config/database');
    const { disconnectRedis } = await import('../../../src/config/redis');
    await disconnectDatabase();
    await disconnectRedis();
  });

  // ─────────────────────────────────────────────
  // Test 1: Only one of N concurrent requests wins
  // ─────────────────────────────────────────────

  it('allows exactly ONE booking when N users concurrently target the same bed', async () => {
    const CONCURRENT_USERS = 5;
    const tokens = tenantTokens.slice(0, CONCURRENT_USERS);

    // Fire all requests simultaneously
    const results = await Promise.allSettled(
      tokens.map((token) =>
        request(app)
          .post('/api/v1/bookings')
          .set('Authorization', `Bearer ${token}`)
          .send({ bed_id: TARGET_BED_ID, intended_check_in: CHECK_IN }),
      ),
    );

    const successes = results.filter(
      (r) => r.status === 'fulfilled' && (r.value as { status: number }).status === 201,
    );
    const conflicts = results.filter(
      (r) =>
        r.status === 'fulfilled' &&
        ((r.value as { status: number }).status === 409 ||
          (r.value as { status: number }).status === 400),
    );

    console.log(
      `Race test results: ${successes.length} success, ${conflicts.length} conflicts out of ${CONCURRENT_USERS}`,
    );

    // Exactly one should succeed
    expect(successes.length).toBe(1);
    // All others should be rejected
    expect(conflicts.length).toBe(CONCURRENT_USERS - 1);

    // Verify DB state: only one PENDING booking exists
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS count FROM bookings
       WHERE assigned_bed_id = $1
         AND current_booking_lifecycle_state = 'PENDING'
         AND deleted_at IS NULL`,
      [TARGET_BED_ID],
    );
    expect(parseInt(rows[0].count, 10)).toBe(1);

    // Verify bed is RESERVED, not VACANT
    const bedRow = await pool.query(
      `SELECT current_occupancy_status FROM beds WHERE id = $1`,
      [TARGET_BED_ID],
    );
    expect(bedRow.rows[0].current_occupancy_status).toBe('RESERVED');
  }, 30000);

  // ─────────────────────────────────────────────
  // Test 2: Sequential booking after release
  // ─────────────────────────────────────────────

  it('allows re-booking after reservation lock expires', async () => {
    // First user books
    const firstRes = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${tenantTokens[0]}`)
      .send({ bed_id: TARGET_BED_ID, intended_check_in: CHECK_IN });

    expect(firstRes.status).toBe(201);
    const bookingId = firstRes.body.data.booking_id;

    // Simulate expiry: cancel the booking and release bed
    await pool.query(`SELECT release_expired_reservation($1)`, [bookingId]);

    // Second user should now be able to book
    const secondRes = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${tenantTokens[1]}`)
      .send({ bed_id: TARGET_BED_ID, intended_check_in: CHECK_IN });

    expect(secondRes.status).toBe(201);
    expect(secondRes.body.data.booking_id).not.toBe(bookingId);
  }, 15000);

  // ─────────────────────────────────────────────
  // Test 3: Idempotency key prevents duplicate bookings
  // ─────────────────────────────────────────────

  it('returns same booking on duplicate idempotency key', async () => {
    const idempotencyKey = `test-idk-${Date.now()}`;

    const [res1, res2] = await Promise.all([
      request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${tenantTokens[0]}`)
        .set('X-Idempotency-Key', idempotencyKey)
        .send({ bed_id: TARGET_BED_ID, intended_check_in: CHECK_IN }),
      delay(50).then(() =>
        request(app)
          .post('/api/v1/bookings')
          .set('Authorization', `Bearer ${tenantTokens[0]}`)
          .set('X-Idempotency-Key', idempotencyKey)
          .send({ bed_id: TARGET_BED_ID, intended_check_in: CHECK_IN }),
      ),
    ]);

    // Both should return the same booking
    expect([201, 200]).toContain(res1.status);
    expect([201, 200]).toContain(res2.status);

    if (res1.status === 201 && res2.status === 201) {
      expect(res1.body.data.booking_id).toBe(res2.body.data.booking_id);
    }

    // Only one booking record in DB
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS count FROM bookings
       WHERE assigned_bed_id = $1 AND deleted_at IS NULL
         AND current_booking_lifecycle_state IN ('PENDING', 'CONFIRMED')`,
      [TARGET_BED_ID],
    );
    expect(parseInt(rows[0].count, 10)).toBe(1);
  }, 15000);

  // ─────────────────────────────────────────────
  // Test 4: 10-user storm test
  // ─────────────────────────────────────────────

  it('handles 10 concurrent requests with exactly 1 success', async () => {
    // Create extra test users if needed
    const extraPhones = Array.from(
      { length: 10 },
      (_, i) => `+919${String(i).padStart(9, '9')}`,
    );
    for (const phone of extraPhones) {
      await pool.query(
        `INSERT INTO users (phone_number, legal_full_name, account_role, identity_kyc_status)
         VALUES ($1, 'Storm User', 'TENANT', 'VERIFIED')
         ON CONFLICT (phone_number) DO NOTHING`,
        [phone],
      );
    }
    const extraTokens = await Promise.all(
      extraPhones.map((p) => getJwtForTestUser(app, p)),
    );

    const results = await Promise.allSettled(
      extraTokens.map((token) =>
        request(app)
          .post('/api/v1/bookings')
          .set('Authorization', `Bearer ${token}`)
          .send({ bed_id: TARGET_BED_ID, intended_check_in: CHECK_IN }),
      ),
    );

    const successCount = results.filter(
      (r) => r.status === 'fulfilled' && (r.value as { status: number }).status === 201,
    ).length;

    expect(successCount).toBe(1);
  }, 45000);
});

// ─────────────────────────────────────────────
// Redis Lock Unit Integration
// ─────────────────────────────────────────────

describeOrSkip('Redis Lock Integration', () => {
  beforeAll(async () => {
    if (INTEGRATION_SKIP) return;
    const { connectRedis } = await import('../../../src/config/redis');
    await connectRedis();
  });

  afterAll(async () => {
    if (INTEGRATION_SKIP) return;
    const { disconnectRedis } = await import('../../../src/config/redis');
    await disconnectRedis();
  });

  it('acquires and releases lock correctly against real Redis', async () => {
    const { acquireBedLock, releaseBedLock, isBedLocked } = await import(
      '../../../src/domains/bookings/services/lock.service'
    );
    const bedId = 'integration-test-bed-id';

    expect(await isBedLocked(bedId)).toBe(false);

    const { lockKey } = await acquireBedLock(bedId, 'session-1', 5000);
    expect(await isBedLocked(bedId)).toBe(true);

    const released = await releaseBedLock(lockKey, 'session-1');
    expect(released).toBe(true);
    expect(await isBedLocked(bedId)).toBe(false);
  });

  it('prevents second lock acquisition while first is held', async () => {
    const { acquireBedLock, releaseBedLock } = await import(
      '../../../src/domains/bookings/services/lock.service'
    );
    const { BedAlreadyReservedError } = await import('../../../src/shared/errors');
    const bedId = 'lock-contention-test';

    const { lockKey } = await acquireBedLock(bedId, 'session-A', 5000);

    await expect(acquireBedLock(bedId, 'session-B', 5000)).rejects.toThrow(
      BedAlreadyReservedError,
    );

    await releaseBedLock(lockKey, 'session-A');
  });

  it('lock auto-expires after TTL', async () => {
    const { acquireBedLock, isBedLocked } = await import(
      '../../../src/domains/bookings/services/lock.service'
    );
    const bedId = 'ttl-test-bed';

    await acquireBedLock(bedId, 'session-ttl', 200); // 200ms TTL
    expect(await isBedLocked(bedId)).toBe(true);

    await delay(300);

    expect(await isBedLocked(bedId)).toBe(false);
  });
});
