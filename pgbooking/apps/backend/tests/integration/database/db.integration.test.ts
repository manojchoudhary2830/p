/**
 * Database Integration Tests
 * Validates PostGIS queries, stored procedures, and data integrity constraints.
 * Requires: live PostgreSQL with PostGIS + seed data loaded.
 */

import { Pool } from 'pg';

const INTEGRATION_SKIP = process.env.SKIP_INTEGRATION === 'true';
const describeOrSkip = INTEGRATION_SKIP ? describe.skip : describe;

let pool: Pool;

beforeAll(async () => {
  if (INTEGRATION_SKIP) return;
  const { connectDatabase, getPool } = await import('../../../src/config/database');
  await connectDatabase();
  pool = getPool();
});

afterAll(async () => {
  if (INTEGRATION_SKIP) return;
  const { disconnectDatabase } = await import('../../../src/config/database');
  await disconnectDatabase();
});

// ─────────────────────────────────────────────
// PostGIS Spatial Search
// ─────────────────────────────────────────────

describeOrSkip('PostGIS Spatial Search', () => {
  const BENGALURU_CENTER = { lat: 12.9716, lng: 77.5946 };

  it('search_properties_in_radius returns results within radius', async () => {
    const { rows } = await pool.query(
      `SELECT * FROM search_properties_in_radius($1, $2, $3, NULL, NULL, NULL, NULL, 20, 0)`,
      [BENGALURU_CENTER.lat, BENGALURU_CENTER.lng, 10.0],
    );

    expect(Array.isArray(rows)).toBe(true);
    rows.forEach((row: { distance_km: number }) => {
      expect(row.distance_km).toBeLessThanOrEqual(10.0);
    });
  });

  it('returns results ordered by distance ascending', async () => {
    const { rows } = await pool.query(
      `SELECT * FROM search_properties_in_radius($1, $2, $3, NULL, NULL, NULL, NULL, 10, 0)`,
      [BENGALURU_CENTER.lat, BENGALURU_CENTER.lng, 20.0],
    );

    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].distance_km).toBeGreaterThanOrEqual(rows[i - 1].distance_km);
    }
  });

  it('filters by gender_policy correctly', async () => {
    const { rows } = await pool.query(
      `SELECT * FROM search_properties_in_radius($1, $2, $3, $4::gender_policy_enum, NULL, NULL, NULL, 20, 0)`,
      [BENGALURU_CENTER.lat, BENGALURU_CENTER.lng, 20.0, 'FEMALE'],
    );

    rows.forEach((row: { gender_segregation_policy: string }) => {
      expect(row.gender_segregation_policy).toBe('FEMALE');
    });
  });

  it('excludes properties with zero vacant beds', async () => {
    const { rows } = await pool.query(
      `SELECT * FROM search_properties_in_radius($1, $2, $3, NULL, NULL, NULL, NULL, 20, 0)`,
      [BENGALURU_CENTER.lat, BENGALURU_CENTER.lng, 50.0],
    );

    rows.forEach((row: { vacant_beds: number }) => {
      expect(row.vacant_beds).toBeGreaterThan(0);
    });
  });

  it('filters by rent range', async () => {
    const { rows } = await pool.query(
      `SELECT * FROM search_properties_in_radius($1, $2, $3, NULL, $4, $5, NULL, 20, 0)`,
      [BENGALURU_CENTER.lat, BENGALURU_CENTER.lng, 20.0, 5000, 10000],
    );

    rows.forEach((row: { min_rent: number; max_rent: number }) => {
      expect(row.min_rent).toBeGreaterThanOrEqual(5000);
    });
  });

  it('completes within 200ms for 50km radius (performance gate)', async () => {
    const start = Date.now();
    await pool.query(
      `SELECT * FROM search_properties_in_radius($1, $2, $3, NULL, NULL, NULL, NULL, 50, 0)`,
      [BENGALURU_CENTER.lat, BENGALURU_CENTER.lng, 50.0],
    );
    const elapsed = Date.now() - start;
    console.log(`PostGIS search latency: ${elapsed}ms`);
    expect(elapsed).toBeLessThan(200);
  });

  it('returns empty array for location with no properties', async () => {
    // Middle of the ocean
    const { rows } = await pool.query(
      `SELECT * FROM search_properties_in_radius($1, $2, $3, NULL, NULL, NULL, NULL, 10, 0)`,
      [0.0, 0.0, 5.0],
    );
    expect(rows.length).toBe(0);
  });
});

// ─────────────────────────────────────────────
// Stored Procedure Tests
// ─────────────────────────────────────────────

describeOrSkip('Stored Procedures', () => {
  const VACANT_BED_ID = '30000000-0000-0000-0000-000000000001';
  const TENANT_ID = '00000000-0000-0000-0000-000000000004';

  async function resetBed() {
    await pool.query(
      `UPDATE beds SET current_occupancy_status = 'VACANT' WHERE id = $1`,
      [VACANT_BED_ID],
    );
    await pool.query(
      `UPDATE bookings SET current_booking_lifecycle_state = 'CANCELLED', deleted_at = NOW()
       WHERE assigned_bed_id = $1 AND current_booking_lifecycle_state IN ('PENDING','CONFIRMED')`,
      [VACANT_BED_ID],
    );
  }

  beforeEach(resetBed);
  afterAll(resetBed);

  it('initialize_booking_transaction creates booking and marks bed RESERVED', async () => {
    const idkKey = `test-idk-${Date.now()}`;
    const expiresAt = new Date(Date.now() + 600000);

    const { rows } = await pool.query(
      `SELECT * FROM initialize_booking_transaction($1, $2, $3, $4, $5, $6)`,
      [VACANT_BED_ID, TENANT_ID, '2026-08-01', idkKey, expiresAt.toISOString(), `lock:bed:${VACANT_BED_ID}`],
    );

    expect(rows.length).toBe(1);
    expect(rows[0].booking_id).toBeTruthy();
    expect(parseFloat(rows[0].token_deposit_amount)).toBeGreaterThan(0);

    const bedStatus = await pool.query(
      `SELECT current_occupancy_status FROM beds WHERE id = $1`,
      [VACANT_BED_ID],
    );
    expect(bedStatus.rows[0].current_occupancy_status).toBe('RESERVED');
  });

  it('initialize_booking_transaction raises exception for OCCUPIED bed', async () => {
    await pool.query(
      `UPDATE beds SET current_occupancy_status = 'OCCUPIED' WHERE id = $1`,
      [VACANT_BED_ID],
    );

    await expect(
      pool.query(
        `SELECT * FROM initialize_booking_transaction($1, $2, $3, $4, $5, $6)`,
        [VACANT_BED_ID, TENANT_ID, '2026-08-01', `idk-${Date.now()}`, new Date().toISOString(), 'lock:test'],
      ),
    ).rejects.toThrow();
  });

  it('release_expired_reservation releases bed back to VACANT', async () => {
    const idkKey = `idk-expire-${Date.now()}`;
    const { rows: bookingRows } = await pool.query(
      `SELECT * FROM initialize_booking_transaction($1, $2, $3, $4, $5, $6)`,
      [VACANT_BED_ID, TENANT_ID, '2026-08-01', idkKey, new Date(Date.now() + 1000).toISOString(), 'lock:test'],
    );
    const bookingId = bookingRows[0].booking_id;

    const { rows: releaseRows } = await pool.query(
      `SELECT release_expired_reservation($1)`,
      [bookingId],
    );
    expect(releaseRows[0].release_expired_reservation).toBe(true);

    const bedStatus = await pool.query(
      `SELECT current_occupancy_status FROM beds WHERE id = $1`,
      [VACANT_BED_ID],
    );
    expect(bedStatus.rows[0].current_occupancy_status).toBe('VACANT');
  });

  it('release_expired_reservation returns false for already confirmed booking', async () => {
    // Manually insert a CONFIRMED booking
    const { rows } = await pool.query(
      `INSERT INTO bookings (tenant_user_id, assigned_bed_id, current_booking_lifecycle_state,
        scheduled_check_in_date, monthly_rent_amount, security_deposit_amount, idempotency_key)
       VALUES ($1, $2, 'CONFIRMED', '2026-08-01', 12000, 24000, $3)
       RETURNING id`,
      [TENANT_ID, VACANT_BED_ID, `confirmed-idk-${Date.now()}`],
    );
    const bookingId = rows[0].id;

    const { rows: releaseRows } = await pool.query(
      `SELECT release_expired_reservation($1)`,
      [bookingId],
    );
    expect(releaseRows[0].release_expired_reservation).toBe(false);

    await pool.query(`DELETE FROM bookings WHERE id = $1`, [bookingId]);
  });
});

// ─────────────────────────────────────────────
// Database Constraint Tests
// ─────────────────────────────────────────────

describeOrSkip('Database Constraints', () => {
  it('enforces unique phone number constraint on users', async () => {
    await expect(
      pool.query(
        `INSERT INTO users (phone_number, legal_full_name) VALUES ($1, 'Duplicate User')`,
        ['+919876543210'],
      ),
    ).rejects.toThrow(/unique/i);
  });

  it('enforces FK constraint: property must reference existing owner', async () => {
    await expect(
      pool.query(
        `INSERT INTO properties (landlord_owner_id, property_display_name, physical_address_line,
          municipality_city, geo_coordinate_point, gender_segregation_policy)
         VALUES ('00000000-0000-0000-dead-000000000000', 'Bad Property', '123 St', 'City',
           ST_SetSRID(ST_MakePoint(77.5, 12.9), 4326), 'MALE')`,
      ),
    ).rejects.toThrow(/foreign key/i);
  });

  it('enforces bed_status_enum constraint', async () => {
    await expect(
      pool.query(
        `UPDATE beds SET current_occupancy_status = 'INVALID_STATUS' WHERE id = $1`,
        ['30000000-0000-0000-0000-000000000001'],
      ),
    ).rejects.toThrow();
  });

  it('enforces positive rent constraint on rooms', async () => {
    await expect(
      pool.query(
        `UPDATE rooms SET standard_monthly_rent_amount = -500 WHERE id = $1`,
        ['20000000-0000-0000-0000-000000000001'],
      ),
    ).rejects.toThrow(/check/i);
  });

  it('enforces unique bed code per room constraint', async () => {
    const roomId = '20000000-0000-0000-0000-000000000001';
    await expect(
      pool.query(
        `INSERT INTO beds (room_parent_id, bed_spatial_code) VALUES ($1, 'A')`,
        [roomId],
      ),
    ).rejects.toThrow(/unique/i);
  });

  it('property bed counter trigger fires on bed insert', async () => {
    const propertyId = '10000000-0000-0000-0000-000000000001';
    const before = await pool.query<{ vacant_beds: number; total_beds: number }>(
      `SELECT vacant_beds, total_beds FROM properties WHERE id = $1`,
      [propertyId],
    );
    const beforeVacant = before.rows[0].vacant_beds;

    const newBed = await pool.query<{ id: string }>(
      `INSERT INTO beds (room_parent_id, bed_spatial_code) VALUES ($1, 'ZTEST') RETURNING id`,
      ['20000000-0000-0000-0000-000000000001'],
    );

    const after = await pool.query<{ vacant_beds: number; total_beds: number }>(
      `SELECT vacant_beds, total_beds FROM properties WHERE id = $1`,
      [propertyId],
    );

    expect(after.rows[0].vacant_beds).toBe(beforeVacant + 1);

    // Cleanup
    await pool.query(`DELETE FROM beds WHERE id = $1`, [newBed.rows[0].id]);
  });
});
