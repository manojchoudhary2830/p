import { makeUser, testIds } from '../fixtures/setup';

jest.mock('@config/database');
jest.mock('@config/redis');
jest.mock('@infrastructure/queue/bullmq.client');
jest.mock('@infrastructure/sms/twilio.client');

describe('Auth Service', () => {
  const mockAuthRepo = {
    findUserByPhone: jest.fn(),
    findUserById: jest.fn(),
    createUser: jest.fn(),
    updateUserProfile: jest.fn(),
    updateUserLastLogin: jest.fn(),
    saveOtpLog: jest.fn(),
    getActiveOtpLog: jest.fn(),
    incrementOtpAttempt: jest.fn(),
    lockOtp: jest.fn(),
    markOtpUsed: jest.fn(),
    createRefreshToken: jest.fn(),
    findRefreshToken: jest.fn(),
    revokeRefreshToken: jest.fn(),
    revokeAllUserTokens: jest.fn(),
    revokeAllUserTokensInFamily: jest.fn(),
  };

  jest.mock('@domains/auth/repositories/auth.repository', () => mockAuthRepo);

  beforeEach(() => jest.clearAllMocks());

  // ─────────────────────────────────────────────
  // sendOtp
  // ─────────────────────────────────────────────

  describe('sendOtp', () => {
    it('sends OTP and returns cooldown on success', async () => {
      const { sendOtp } = await import('@domains/auth/services/auth.service');
      const { getCacheClient } = await import('@config/redis');
      const mockCache = getCacheClient() as { ttl: jest.Mock; setex: jest.Mock };

      mockCache.ttl.mockResolvedValueOnce(-1); // no cooldown active
      mockAuthRepo.saveOtpLog.mockResolvedValueOnce('otp-log-id');
      mockCache.setex.mockResolvedValueOnce('OK');

      const { dispatchSms } = await import('@infrastructure/queue/bullmq.client');

      const result = await sendOtp({ phoneNumber: '+919876543213' });

      expect(result.message).toBe('OTP sent successfully');
      expect(result.resendAfterSeconds).toBeGreaterThan(0);
      expect(dispatchSms).toHaveBeenCalled();
      expect(mockAuthRepo.saveOtpLog).toHaveBeenCalledWith(
        expect.objectContaining({ phoneNumber: '+919876543213' }),
      );
    });

    it('respects resend cooldown and returns remaining time', async () => {
      const { sendOtp } = await import('@domains/auth/services/auth.service');
      const { getCacheClient } = await import('@config/redis');
      const mockCache = getCacheClient() as { ttl: jest.Mock };

      mockCache.ttl.mockResolvedValueOnce(45); // 45 seconds remaining

      const result = await sendOtp({ phoneNumber: '+919876543213' });

      expect(result.resendAfterSeconds).toBe(45);
      expect(mockAuthRepo.saveOtpLog).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  // verifyOtp
  // ─────────────────────────────────────────────

  describe('verifyOtp', () => {
    const validOtp = '123456';

    function makeOtpLog(overrides = {}) {
      const { hashToken } = jest.requireActual('@shared/utils/crypto') as { hashToken: (t: string) => string };
      return {
        id: 'otp-log-id',
        otp_hash: hashToken(validOtp),
        attempts: 0,
        is_locked: false,
        lock_expires_at: null,
        expires_at: new Date(Date.now() + 300000),
        ...overrides,
      };
    }

    it('issues token pair for valid OTP and existing user', async () => {
      const { verifyOtp } = await import('@domains/auth/services/auth.service');
      const { getCacheClient } = await import('@config/redis');
      const mockCache = getCacheClient() as { del: jest.Mock };

      mockAuthRepo.getActiveOtpLog.mockResolvedValueOnce(makeOtpLog());
      mockAuthRepo.markOtpUsed.mockResolvedValueOnce(undefined);
      mockAuthRepo.findUserByPhone.mockResolvedValueOnce(makeUser());
      mockAuthRepo.updateUserProfile.mockResolvedValueOnce(makeUser());
      mockAuthRepo.updateUserLastLogin.mockResolvedValueOnce(undefined);
      mockAuthRepo.createRefreshToken.mockResolvedValueOnce(undefined);
      mockCache.del.mockResolvedValueOnce(1);

      const result = await verifyOtp({
        phoneNumber: '+919876543213',
        otp: validOtp,
      });

      expect(result.accessToken).toBeTruthy();
      expect(result.refreshToken).toBeTruthy();
      expect(result.isNewUser).toBe(false);
      expect(result.user.phone_number).toBe('+919876543213');
    });

    it('creates new user account for first-time login', async () => {
      const { verifyOtp } = await import('@domains/auth/services/auth.service');
      const { getCacheClient } = await import('@config/redis');
      const mockCache = getCacheClient() as { del: jest.Mock };

      mockAuthRepo.getActiveOtpLog.mockResolvedValueOnce(makeOtpLog());
      mockAuthRepo.markOtpUsed.mockResolvedValueOnce(undefined);
      mockAuthRepo.findUserByPhone.mockResolvedValueOnce(null); // new user
      mockAuthRepo.createUser.mockResolvedValueOnce(makeUser());
      mockAuthRepo.updateUserProfile.mockResolvedValueOnce(makeUser());
      mockAuthRepo.updateUserLastLogin.mockResolvedValueOnce(undefined);
      mockAuthRepo.createRefreshToken.mockResolvedValueOnce(undefined);
      mockCache.del.mockResolvedValueOnce(1);

      const result = await verifyOtp({ phoneNumber: '+919876543213', otp: validOtp });

      expect(result.isNewUser).toBe(true);
      expect(mockAuthRepo.createUser).toHaveBeenCalled();
    });

    it('throws OtpExpiredError when no active OTP log', async () => {
      const { verifyOtp } = await import('@domains/auth/services/auth.service');
      mockAuthRepo.getActiveOtpLog.mockResolvedValueOnce(null);

      const { OtpExpiredError } = await import('@shared/errors');
      await expect(
        verifyOtp({ phoneNumber: '+919876543213', otp: '000000' }),
      ).rejects.toThrow(OtpExpiredError);
    });

    it('throws OtpInvalidError with remaining attempts on wrong OTP', async () => {
      const { verifyOtp } = await import('@domains/auth/services/auth.service');
      mockAuthRepo.getActiveOtpLog.mockResolvedValueOnce(makeOtpLog());
      mockAuthRepo.incrementOtpAttempt.mockResolvedValueOnce({ attempts: 1, shouldLock: false });

      const { OtpInvalidError } = await import('@shared/errors');
      await expect(
        verifyOtp({ phoneNumber: '+919876543213', otp: '999999' }),
      ).rejects.toThrow(OtpInvalidError);
    });

    it('locks OTP after max failed attempts', async () => {
      const { verifyOtp } = await import('@domains/auth/services/auth.service');
      mockAuthRepo.getActiveOtpLog.mockResolvedValueOnce(makeOtpLog());
      mockAuthRepo.incrementOtpAttempt.mockResolvedValueOnce({ attempts: 3, shouldLock: true });
      mockAuthRepo.lockOtp.mockResolvedValueOnce(undefined);

      const { OtpLockedError } = await import('@shared/errors');
      await expect(
        verifyOtp({ phoneNumber: '+919876543213', otp: '000000' }),
      ).rejects.toThrow(OtpLockedError);
      expect(mockAuthRepo.lockOtp).toHaveBeenCalled();
    });

    it('throws OtpLockedError if OTP is already locked', async () => {
      const { verifyOtp } = await import('@domains/auth/services/auth.service');
      mockAuthRepo.getActiveOtpLog.mockResolvedValueOnce(
        makeOtpLog({ is_locked: true, lock_expires_at: new Date(Date.now() + 300000) }),
      );

      const { OtpLockedError } = await import('@shared/errors');
      await expect(
        verifyOtp({ phoneNumber: '+919876543213', otp: '123456' }),
      ).rejects.toThrow(OtpLockedError);
    });
  });
});

// ─────────────────────────────────────────────
// Crypto Utils
// ─────────────────────────────────────────────

describe('Crypto Utilities', () => {
  let crypto: typeof import('@shared/utils/crypto');

  beforeAll(async () => {
    crypto = await import('@shared/utils/crypto');
  });

  describe('generateOtp', () => {
    it('generates 6-digit OTP by default', () => {
      const otp = crypto.generateOtp();
      expect(otp).toMatch(/^\d{6}$/);
    });

    it('generates OTP of specified length', () => {
      for (let len = 4; len <= 8; len++) {
        const otp = crypto.generateOtp(len);
        expect(otp.length).toBe(len);
        expect(otp).toMatch(/^\d+$/);
      }
    });

    it('generates unique OTPs (probabilistic)', () => {
      const otps = new Set(Array.from({ length: 100 }, () => crypto.generateOtp()));
      expect(otps.size).toBeGreaterThan(90);
    });
  });

  describe('hashToken', () => {
    it('produces consistent SHA-256 hashes', () => {
      const hash1 = crypto.hashToken('test-token');
      const hash2 = crypto.hashToken('test-token');
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });

    it('different tokens produce different hashes', () => {
      expect(crypto.hashToken('token-a')).not.toBe(crypto.hashToken('token-b'));
    });
  });

  describe('encryptSensitiveData / decryptSensitiveData', () => {
    it('encrypts and decrypts data correctly', () => {
      const plaintext = 'AADHAAR-1234-5678-9012';
      const encrypted = crypto.encryptSensitiveData(plaintext);
      expect(encrypted).not.toBe(plaintext);
      const decrypted = crypto.decryptSensitiveData(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('produces different ciphertext for same plaintext (random IV)', () => {
      const pt = 'same-plaintext';
      expect(crypto.encryptSensitiveData(pt)).not.toBe(crypto.encryptSensitiveData(pt));
    });
  });

  describe('normalizePhoneNumber', () => {
    it('normalizes 10-digit Indian numbers', () => {
      expect(crypto.normalizePhoneNumber('9876543210')).toBe('+919876543210');
    });
    it('preserves already-normalized numbers', () => {
      expect(crypto.normalizePhoneNumber('+919876543210')).toBe('+919876543210');
    });
  });
});
