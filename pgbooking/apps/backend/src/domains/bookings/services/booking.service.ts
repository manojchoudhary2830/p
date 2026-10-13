import { v4 as uuidv4 } from 'uuid';
import { getPool } from '@config/database';
import { env } from '@config/environment';
import { logger } from '@shared/utils/logger';
import {
  NotFoundError, ForbiddenError, KycRequiredError,
  ReservationExpiredError, BadRequestError,
} from '@shared/errors';
import { buildPaginatedResult } from '@shared/utils/response';
import { BookingStatus, KycStatus, PaginationParams } from '@shared/types';
import { scheduleReservationRelease, cancelReservationRelease } from '@infrastructure/queue/bullmq.client';
import * as lockService from './lock.service';
import * as bookingRepo from '../repositories/booking.repository';
import { findUserById } from '@domains/auth/repositories/auth.repository';
import { findPropertyById } from '@domains/properties/repositories/property.repository';
import type { InitiateBookingDto, CancelBookingDto } from '../validators/booking.validator';

// ─────────────────────────────────────────────
// Initiate Booking — Two-Stage Lock
//
// Stage 1: Acquire Redis lock (prevents concurrent checkout attempts)
// Stage 2: DB transaction with SELECT FOR UPDATE (prevents double-booking)
// ─────────────────────────────────────────────

export async function initiateBooking(
  tenantId: string,
  dto: InitiateBookingDto,
): Promise<{
  bookingId: string;
  lockExpirationTimestamp: string;
  requiredTokenAmount: number;
  monthlyRent: number;
  securityDeposit: number;
  propertyName: string;
  roomCode: string;
  bedCode: string;
}> {
  // ── Pre-checks (fast path, no locks yet) ──────
  const tenant = await findUserById(tenantId);
  if (!tenant) throw new NotFoundError('User', tenantId);

  // KYC required for booking
  if (tenant.identity_kyc_status !== KycStatus.VERIFIED) {
    throw new KycRequiredError();
  }

  const idempotencyKey = dto.idempotency_key ?? uuidv4();
  const sessionId = uuidv4();
  const lockExpiresAt = new Date(Date.now() + env.BOOKING_LOCK_TTL_MS);

  // ── Stage 1: Redis distributed lock ──────────
  // Prevents two users from entering the DB transaction for the same bed simultaneously
  const { lockKey } = await lockService.acquireBedLock(dto.bed_id, sessionId);

  let bookingId: string | null = null;

  try {
    // ── Stage 2: DB transaction with row-level lock ──
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const result = await bookingRepo.initializeBookingTransaction({
        bedId: dto.bed_id,
        tenantId,
        checkInDate: dto.intended_check_in,
        idempotencyKey,
        lockExpiresAt,
        lockRedisKey: lockKey,
        client,
      });

      await client.query('COMMIT');
      bookingId = result.booking_id;

      logger.info('Booking initialized', {
        bookingId,
        tenantId,
        bedId: dto.bed_id,
        lockExpiresAt: lockExpiresAt.toISOString(),
      });

      // ── Schedule automatic reservation expiry ────
      // If payment is not completed in 10 minutes, bed is released
      await scheduleReservationRelease(
        { bookingId, bedId: dto.bed_id, lockKey },
        env.BOOKING_LOCK_TTL_MS,
      );

      return {
        bookingId: result.booking_id,
        lockExpirationTimestamp: lockExpiresAt.toISOString(),
        requiredTokenAmount: parseFloat(result.token_deposit_amount),
        monthlyRent: parseFloat(result.monthly_rent),
        securityDeposit: parseFloat(result.security_deposit),
        propertyName: result.property_name,
        roomCode: result.room_code,
        bedCode: result.bed_code,
      };
    } catch (dbError) {
      await client.query('ROLLBACK');
      // Release Redis lock on DB failure
      await lockService.releaseBedLock(lockKey, sessionId);
      throw dbError;
    } finally {
      client.release();
    }
  } catch (error) {
    const err = error as Error & { message: string };
    // Map PostgreSQL stored procedure exceptions to domain errors
    if (err.message?.includes('BED_NOT_VACANT') || err.message?.includes('BED_NOT_FOUND')) {
      throw new BadRequestError('This bed is no longer available. Please select another bed.');
    }
    if (err.message?.includes('IDEMPOTENCY_KEY_EXISTS')) {
      const existingBookingId = err.message.split(':')[1]?.trim();
      const existing = existingBookingId ? await bookingRepo.findBookingById(existingBookingId) : null;
      if (existing) {
        return {
          bookingId: existing.id,
          lockExpirationTimestamp: existing.reservation_lock_expires_at?.toISOString() ?? '',
          requiredTokenAmount: 0,
          monthlyRent: parseFloat(existing.monthly_rent_amount),
          securityDeposit: parseFloat(existing.security_deposit_amount),
          propertyName: '',
          roomCode: '',
          bedCode: '',
        };
      }
    }
    throw error;
  }
}

// ─────────────────────────────────────────────
// Confirm Booking (called after payment success)
// ─────────────────────────────────────────────

export async function confirmBooking(
  bookingId: string,
  paymentId: string,
): Promise<void> {
  const booking = await bookingRepo.findBookingById(bookingId);
  if (!booking) throw new NotFoundError('Booking', bookingId);

  if (booking.current_booking_lifecycle_state !== BookingStatus.PENDING) {
    throw new BadRequestError(`Booking is already ${booking.current_booking_lifecycle_state}`);
  }

  // Check lock hasn't expired
  if (booking.reservation_lock_expires_at && new Date() > booking.reservation_lock_expires_at) {
    throw new ReservationExpiredError();
  }

  await bookingRepo.confirmBookingAfterPayment(bookingId, paymentId);

  // Cancel the scheduled expiry job — booking is confirmed
  await cancelReservationRelease(bookingId);

  // Release Redis lock — no longer needed after confirmation
  if (booking.lock_redis_key) {
    await lockService.forceReleaseBedLock(booking.lock_redis_key);
  }

  logger.info('Booking confirmed', { bookingId, paymentId });
}

// ─────────────────────────────────────────────
// Cancel Booking
// ─────────────────────────────────────────────

export async function cancelBooking(
  bookingId: string,
  requestingUserId: string,
  isAdmin: boolean,
  dto: CancelBookingDto,
): Promise<void> {
  const booking = await bookingRepo.findBookingById(bookingId);
  if (!booking) throw new NotFoundError('Booking', bookingId);

  if (!isAdmin && booking.tenant_user_id !== requestingUserId) {
    throw new ForbiddenError('You can only cancel your own bookings');
  }

  await bookingRepo.cancelBooking(
    bookingId,
    requestingUserId,
    dto.reason ?? 'Cancelled by user',
  );

  // Cancel expiry job if pending
  await cancelReservationRelease(bookingId);

  // Release Redis lock if still held
  if (booking.lock_redis_key) {
    await lockService.forceReleaseBedLock(booking.lock_redis_key);
  }

  logger.info('Booking cancelled', { bookingId, cancelledBy: requestingUserId });
}

// ─────────────────────────────────────────────
// Get Booking (with ownership check)
// ─────────────────────────────────────────────

export async function getBooking(bookingId: string, requestingUserId: string, isAdmin: boolean) {
  const booking = await bookingRepo.findBookingById(bookingId);
  if (!booking) throw new NotFoundError('Booking', bookingId);

  if (!isAdmin && booking.tenant_user_id !== requestingUserId) {
    // Check if requester is the property owner
    // (owners can view bookings for their properties)
    throw new ForbiddenError('Access denied');
  }

  return booking;
}

export async function getTenantBookings(tenantId: string, pagination: PaginationParams) {
  const { rows, total } = await bookingRepo.findBookingsForTenant(tenantId, pagination);
  return buildPaginatedResult(rows, total, pagination);
}

export async function getOwnerBookings(
  ownerId: string,
  pagination: PaginationParams,
  status?: BookingStatus,
) {
  const { rows, total } = await bookingRepo.findBookingsForOwner(ownerId, pagination, status);
  return buildPaginatedResult(rows, total, pagination);
}

export async function checkoutBooking(
  bookingId: string,
  ownerId: string,
  actualCheckOutDate: string,
  notes?: string,
): Promise<void> {
  const booking = await bookingRepo.findBookingById(bookingId);
  if (!booking) throw new NotFoundError('Booking', bookingId);

  if (booking.current_booking_lifecycle_state !== BookingStatus.CONFIRMED) {
    throw new BadRequestError('Only confirmed bookings can be checked out');
  }

  await bookingRepo.checkoutBooking(bookingId, actualCheckOutDate, notes ?? null);
  logger.info('Tenant checked out', { bookingId, ownerId });
}
