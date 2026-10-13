import { PoolClient } from 'pg';
import { query, queryOne, queryMany, withTransaction } from '@config/database';
import { BookingRow, BookingStatus, PaginationParams } from '@shared/types';

// ─────────────────────────────────────────────
// Read
// ─────────────────────────────────────────────

export async function findBookingById(id: string): Promise<BookingRow | null> {
  return queryOne<BookingRow>(
    `SELECT * FROM bookings WHERE id = $1 AND deleted_at IS NULL`,
    [id],
  );
}

export async function findBookingByIdAndTenant(id: string, tenantId: string): Promise<BookingRow | null> {
  return queryOne<BookingRow>(
    `SELECT * FROM bookings WHERE id = $1 AND tenant_user_id = $2 AND deleted_at IS NULL`,
    [id, tenantId],
  );
}

export async function findBookingsForTenant(
  tenantId: string,
  pagination: PaginationParams,
): Promise<{ rows: BookingRow[]; total: number }> {
  const offset = (pagination.page - 1) * pagination.limit;
  const [rows, countRow] = await Promise.all([
    queryMany<BookingRow>(
      `SELECT bk.*, b.bed_spatial_code, r.room_identifier_code, p.property_display_name, p.municipality_city
       FROM bookings bk
       JOIN beds b ON b.id = bk.assigned_bed_id
       JOIN rooms r ON r.id = b.room_parent_id
       JOIN properties p ON p.id = r.property_parent_id
       WHERE bk.tenant_user_id = $1 AND bk.deleted_at IS NULL
       ORDER BY bk.created_at DESC
       LIMIT $2 OFFSET $3`,
      [tenantId, pagination.limit, offset],
    ),
    queryOne<{ count: string }>(
      `SELECT COUNT(*) FROM bookings WHERE tenant_user_id = $1 AND deleted_at IS NULL`,
      [tenantId],
    ),
  ]);
  return { rows, total: parseInt(countRow?.count ?? '0', 10) };
}

export async function findBookingsForOwner(
  ownerId: string,
  pagination: PaginationParams,
  status?: BookingStatus,
): Promise<{ rows: unknown[]; total: number }> {
  const offset = (pagination.page - 1) * pagination.limit;
  const statusFilter = status ? `AND bk.current_booking_lifecycle_state = '${status}'` : '';
  const [rows, countRow] = await Promise.all([
    queryMany(
      `SELECT bk.*,
              t.legal_full_name AS tenant_name, t.phone_number AS tenant_phone,
              b.bed_spatial_code, r.room_identifier_code, p.property_display_name
       FROM bookings bk
       JOIN beds b ON b.id = bk.assigned_bed_id
       JOIN rooms r ON r.id = b.room_parent_id
       JOIN properties p ON p.id = r.property_parent_id
       JOIN users t ON t.id = bk.tenant_user_id
       WHERE p.landlord_owner_id = $1 AND bk.deleted_at IS NULL ${statusFilter}
       ORDER BY bk.created_at DESC
       LIMIT $2 OFFSET $3`,
      [ownerId, pagination.limit, offset],
    ),
    queryOne<{ count: string }>(
      `SELECT COUNT(*) FROM bookings bk
       JOIN beds b ON b.id = bk.assigned_bed_id
       JOIN rooms r ON r.id = b.room_parent_id
       JOIN properties p ON p.id = r.property_parent_id
       WHERE p.landlord_owner_id = $1 AND bk.deleted_at IS NULL`,
      [ownerId],
    ),
  ]);
  return { rows, total: parseInt(countRow?.count ?? '0', 10) };
}

export async function findActiveBookingForBed(bedId: string): Promise<BookingRow | null> {
  return queryOne<BookingRow>(
    `SELECT * FROM bookings
     WHERE assigned_bed_id = $1
       AND current_booking_lifecycle_state IN ('PENDING', 'CONFIRMED')
       AND deleted_at IS NULL
     LIMIT 1`,
    [bedId],
  );
}

// ─────────────────────────────────────────────
// Write (using stored procedures from migration 007)
// ─────────────────────────────────────────────

export interface InitBookingResult {
  booking_id: string;
  monthly_rent: string;
  security_deposit: string;
  token_deposit_amount: string;
  property_name: string;
  room_code: string;
  bed_code: string;
}

export async function initializeBookingTransaction(params: {
  bedId: string;
  tenantId: string;
  checkInDate: string;
  idempotencyKey: string;
  lockExpiresAt: Date;
  lockRedisKey: string;
  client: PoolClient;
}): Promise<InitBookingResult> {
  const result = await params.client.query<InitBookingResult>(
    `SELECT * FROM initialize_booking_transaction($1,$2,$3,$4,$5,$6)`,
    [
      params.bedId,
      params.tenantId,
      params.checkInDate,
      params.idempotencyKey,
      params.lockExpiresAt.toISOString(),
      params.lockRedisKey,
    ],
  );
  if (!result.rows[0]) throw new Error('Booking initialization failed');
  return result.rows[0];
}

export async function confirmBookingAfterPayment(
  bookingId: string,
  paymentId: string,
  client?: PoolClient,
): Promise<void> {
  const sql = `SELECT confirm_booking_after_payment($1, $2)`;
  if (client) {
    await client.query(sql, [bookingId, paymentId]);
  } else {
    await query(sql, [bookingId, paymentId]);
  }
}

export async function releaseExpiredReservation(bookingId: string): Promise<boolean> {
  const result = await queryOne<{ release_expired_reservation: boolean }>(
    `SELECT release_expired_reservation($1)`,
    [bookingId],
  );
  return result?.release_expired_reservation ?? false;
}

export async function cancelBooking(
  bookingId: string,
  cancelledBy: string,
  reason: string,
): Promise<void> {
  await query(`SELECT cancel_booking($1, $2, $3)`, [bookingId, cancelledBy, reason]);
}

export async function checkoutBooking(
  bookingId: string,
  actualCheckOutDate: string,
  notes: string | null,
): Promise<void> {
  await query(
    `UPDATE bookings
     SET current_booking_lifecycle_state = 'CHECKED_OUT',
         actual_check_out_date = $2,
         checkout_notes = $3,
         updated_at = NOW()
     WHERE id = $1`,
    [bookingId, actualCheckOutDate, notes],
  );
  // Also mark the bed as VACANT
  await query(
    `UPDATE beds SET current_occupancy_status = 'VACANT', last_modified_timestamp = NOW()
     WHERE id = (SELECT assigned_bed_id FROM bookings WHERE id = $1)`,
    [bookingId],
  );
}
