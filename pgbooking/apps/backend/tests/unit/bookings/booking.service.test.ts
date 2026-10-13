import { makeBed, makeBooking, makeUser, testIds } from '../fixtures/setup';

// ─── Mock modules first ───────────────────────
jest.mock('@config/database');
jest.mock('@config/redis');
jest.mock('@infrastructure/queue/bullmq.client');

import { acquireBedLock, releaseBedLock, isBedLocked, getLockTtlMs } from '@domains/bookings/services/lock.service';
import { getLockClient } from '@config/redis';

describe('Booking Lock Service', () => {
  let mockLockClient: { set: jest.Mock; eval: jest.Mock; del: jest.Mock; pttl: jest.Mock };

  beforeEach(() => {
    mockLockClient = {
      set: jest.fn(),
      eval: jest.fn(),
      del: jest.fn(),
      pttl: jest.fn(),
    };
    (getLockClient as jest.Mock).mockReturnValue(mockLockClient);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── acquireBedLock ────────────────────────

  describe('acquireBedLock', () => {
    it('acquires lock when bed is not locked', async () => {
      mockLockClient.set.mockResolvedValueOnce('OK');

      const result = await acquireBedLock(testIds.bed, 'session-abc', 600000);

      expect(result.acquired).toBe(true);
      expect(result.lockKey).toBe(`lock:bed:${testIds.bed}`);
      expect(mockLockClient.set).toHaveBeenCalledWith(
        `lock:bed:${testIds.bed}`,
        'session-abc',
        'PX',
        600000,
        'NX',
      );
    });

    it('throws BedAlreadyReservedError when bed is locked after all retries', async () => {
      mockLockClient.set.mockResolvedValue(null); // lock not acquired

      const { BedAlreadyReservedError } = await import('@shared/errors');
      await expect(acquireBedLock(testIds.bed, 'session-xyz', 600000)).rejects.toThrow(
        BedAlreadyReservedError,
      );
    });

    it('acquires lock on second retry when first fails', async () => {
      mockLockClient.set
        .mockResolvedValueOnce(null)   // first attempt fails
        .mockResolvedValueOnce('OK');  // second attempt succeeds

      const result = await acquireBedLock(testIds.bed, 'session-retry', 600000);
      expect(result.acquired).toBe(true);
      expect(mockLockClient.set).toHaveBeenCalledTimes(2);
    });

    it('propagates Redis errors', async () => {
      mockLockClient.set.mockRejectedValue(new Error('Redis connection failed'));
      await expect(acquireBedLock(testIds.bed, 'session-err', 600000)).rejects.toThrow();
    });
  });

  // ─── releaseBedLock ────────────────────────

  describe('releaseBedLock', () => {
    it('releases lock when caller owns it (Lua returns 1)', async () => {
      mockLockClient.eval.mockResolvedValueOnce(1);

      const released = await releaseBedLock(`lock:bed:${testIds.bed}`, 'session-abc');

      expect(released).toBe(true);
      expect(mockLockClient.eval).toHaveBeenCalledWith(
        expect.stringContaining('redis.call'),
        1,
        `lock:bed:${testIds.bed}`,
        'session-abc',
      );
    });

    it('does NOT release lock owned by different session (Lua returns 0)', async () => {
      mockLockClient.eval.mockResolvedValueOnce(0);

      const released = await releaseBedLock(`lock:bed:${testIds.bed}`, 'different-session');
      expect(released).toBe(false);
    });

    it('returns false on Redis error without throwing', async () => {
      mockLockClient.eval.mockRejectedValueOnce(new Error('timeout'));
      const released = await releaseBedLock(`lock:bed:${testIds.bed}`, 'session-abc');
      expect(released).toBe(false);
    });
  });

  // ─── isBedLocked ──────────────────────────

  describe('isBedLocked', () => {
    it('returns true when lock has positive TTL', async () => {
      mockLockClient.pttl.mockResolvedValueOnce(300000);
      const locked = await isBedLocked(testIds.bed);
      expect(locked).toBe(true);
    });

    it('returns false when lock has no TTL (-1 = key exists no TTL, -2 = missing)', async () => {
      mockLockClient.pttl.mockResolvedValueOnce(-2);
      const locked = await isBedLocked(testIds.bed);
      expect(locked).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────
// Booking Service Unit Tests
// ─────────────────────────────────────────────

describe('Booking Service', () => {
  const mockBookingRepo = {
    findBookingById: jest.fn(),
    initializeBookingTransaction: jest.fn(),
    confirmBookingAfterPayment: jest.fn(),
    cancelBooking: jest.fn(),
    findBookingsForTenant: jest.fn(),
  };

  jest.mock('@domains/bookings/repositories/booking.repository', () => mockBookingRepo);
  jest.mock('@domains/auth/repositories/auth.repository', () => ({
    findUserById: jest.fn(),
  }));
  jest.mock('@domains/bookings/services/lock.service', () => ({
    acquireBedLock: jest.fn(),
    releaseBedLock: jest.fn(),
    forceReleaseBedLock: jest.fn(),
    buildLockKey: (bedId: string) => `lock:bed:${bedId}`,
  }));

  beforeEach(() => jest.clearAllMocks());

  describe('cancelBooking', () => {
    it('cancels a PENDING booking owned by the tenant', async () => {
      const { cancelBooking } = await import('@domains/bookings/services/booking.service');
      const { findBookingById, cancelBooking: repoCancel } = await import('@domains/bookings/repositories/booking.repository');
      const { findUserById } = await import('@domains/auth/repositories/auth.repository');

      (findBookingById as jest.Mock).mockResolvedValueOnce(makeBooking());
      (repoCancel as jest.Mock).mockResolvedValueOnce(undefined);

      await expect(
        cancelBooking(testIds.booking, testIds.tenant, false, { reason: 'Changed my mind' }),
      ).resolves.not.toThrow();

      expect(repoCancel).toHaveBeenCalledWith(testIds.booking, testIds.tenant, 'Changed my mind');
    });

    it('throws ForbiddenError when tenant tries to cancel someone else\'s booking', async () => {
      const { cancelBooking } = await import('@domains/bookings/services/booking.service');
      const { findBookingById } = await import('@domains/bookings/repositories/booking.repository');

      (findBookingById as jest.Mock).mockResolvedValueOnce(makeBooking({ tenant_user_id: 'other-user' }));

      const { ForbiddenError } = await import('@shared/errors');
      await expect(
        cancelBooking(testIds.booking, testIds.tenant, false, {}),
      ).rejects.toThrow(ForbiddenError);
    });

    it('allows admin to cancel any booking', async () => {
      const { cancelBooking } = await import('@domains/bookings/services/booking.service');
      const { findBookingById, cancelBooking: repoCancel } = await import('@domains/bookings/repositories/booking.repository');

      (findBookingById as jest.Mock).mockResolvedValueOnce(makeBooking({ tenant_user_id: 'someone-else' }));
      (repoCancel as jest.Mock).mockResolvedValueOnce(undefined);

      await expect(
        cancelBooking(testIds.booking, testIds.admin, true, { reason: 'Admin override' }),
      ).resolves.not.toThrow();
    });

    it('throws NotFoundError for non-existent booking', async () => {
      const { cancelBooking } = await import('@domains/bookings/services/booking.service');
      const { findBookingById } = await import('@domains/bookings/repositories/booking.repository');

      (findBookingById as jest.Mock).mockResolvedValueOnce(null);

      const { NotFoundError } = await import('@shared/errors');
      await expect(
        cancelBooking('non-existent-id', testIds.tenant, false, {}),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('confirmBooking', () => {
    it('throws ReservationExpiredError when lock window has passed', async () => {
      const { confirmBooking } = await import('@domains/bookings/services/booking.service');
      const { findBookingById } = await import('@domains/bookings/repositories/booking.repository');

      (findBookingById as jest.Mock).mockResolvedValueOnce(
        makeBooking({ reservation_lock_expires_at: new Date(Date.now() - 1000) })
      );

      const { ReservationExpiredError } = await import('@shared/errors');
      await expect(
        confirmBooking(testIds.booking, testIds.payment),
      ).rejects.toThrow(ReservationExpiredError);
    });

    it('throws BadRequestError if booking is already CONFIRMED', async () => {
      const { confirmBooking } = await import('@domains/bookings/services/booking.service');
      const { findBookingById } = await import('@domains/bookings/repositories/booking.repository');

      (findBookingById as jest.Mock).mockResolvedValueOnce(
        makeBooking({ current_booking_lifecycle_state: 'CONFIRMED' })
      );

      const { BadRequestError } = await import('@shared/errors');
      await expect(
        confirmBooking(testIds.booking, testIds.payment),
      ).rejects.toThrow(BadRequestError);
    });
  });
});
