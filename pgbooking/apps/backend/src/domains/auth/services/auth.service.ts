import { v4 as uuidv4 } from 'uuid';
import { env } from '@config/environment';
import { getCacheClient } from '@config/redis';
import { generateOtp, compareOtp, hashToken, normalizePhoneNumber } from '@shared/utils/crypto';
import { generateTokenPair } from '@shared/utils/jwt';
import { dispatchSms } from '@infrastructure/queue/bullmq.client';
import { JOB_NAMES } from '@infrastructure/queue/bullmq.client';
import { logger } from '@shared/utils/logger';
import {
  OtpInvalidError,
  OtpExpiredError,
  OtpLockedError,
  UnauthorizedError,
  NotFoundError,
} from '@shared/errors';
import { UserRole, UserRow } from '@shared/types';
import * as authRepo from '../repositories/auth.repository';

// ─────────────────────────────────────────────
// OTP Service
// ─────────────────────────────────────────────

export async function sendOtp(params: {
  phoneNumber: string;
  ipAddress?: string;
}): Promise<{ message: string; resendAfterSeconds: number }> {
  const normalizedPhone = normalizePhoneNumber(params.phoneNumber);

  // Check resend cooldown via Redis
  const cooldownKey = `${env.REDIS_KEY_PREFIX}otp:cooldown:${normalizedPhone}`;
  const cache = getCacheClient();
  const cooldownTtl = await cache.ttl(cooldownKey);

  if (cooldownTtl > 0) {
    return {
      message: `OTP already sent. You can request a new one in ${cooldownTtl} seconds.`,
      resendAfterSeconds: cooldownTtl,
    };
  }

  // Generate OTP
  const otp = generateOtp(env.OTP_LENGTH);
  const otpHash = hashToken(otp); // SHA-256, never store plaintext
  const expiresAt = new Date(Date.now() + env.OTP_EXPIRY_SECONDS * 1000);

  // Persist OTP log to DB
  await authRepo.saveOtpLog({
    phoneNumber: normalizedPhone,
    otpHash,
    expiresAt,
    ipAddress: params.ipAddress,
  });

  // Set resend cooldown in Redis
  await cache.setex(cooldownKey, env.OTP_RESEND_COOLDOWN_SECONDS, '1');

  // Queue SMS (high priority, immediate delivery)
  await dispatchSms(
    { to: normalizedPhone, message: otp, type: 'OTP' },
    JOB_NAMES.SEND_OTP_SMS,
  );

  // In development: log OTP for testing (NEVER in production)
  if (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') {
    logger.warn(`[DEV ONLY] OTP for ${normalizedPhone}: ${otp}`);
  }

  return {
    message: 'OTP sent successfully',
    resendAfterSeconds: env.OTP_RESEND_COOLDOWN_SECONDS,
  };
}

export async function verifyOtp(params: {
  phoneNumber: string;
  otp: string;
  deviceId?: string;
  deviceInfo?: Record<string, unknown>;
  ipAddress?: string;
}): Promise<{
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
  user: Omit<UserRow, 'deleted_at'>;
  isNewUser: boolean;
}> {
  const normalizedPhone = normalizePhoneNumber(params.phoneNumber);

  // Fetch active OTP log from DB
  const otpLog = await authRepo.getActiveOtpLog(normalizedPhone);

  if (!otpLog) {
    throw new OtpExpiredError();
  }

  // Check if OTP is locked
  if (otpLog.is_locked) {
    const now = new Date();
    const lockExpiry = otpLog.lock_expires_at;
    if (lockExpiry && lockExpiry > now) {
      const remainingSeconds = Math.ceil((lockExpiry.getTime() - now.getTime()) / 1000);
      throw new OtpLockedError(remainingSeconds);
    }
  }

  // Check if OTP has expired
  if (new Date() > otpLog.expires_at) {
    throw new OtpExpiredError();
  }

  // Verify OTP (constant-time comparison)
  const providedHash = hashToken(params.otp);
  const isValid = compareOtp(providedHash, otpLog.otp_hash);

  if (!isValid) {
    const { attempts, shouldLock } = await authRepo.incrementOtpAttempt(
      otpLog.id,
      env.OTP_MAX_ATTEMPTS,
    );

    if (shouldLock) {
      await authRepo.lockOtp(otpLog.id, env.OTP_LOCKOUT_DURATION_SECONDS);
      throw new OtpLockedError(env.OTP_LOCKOUT_DURATION_SECONDS);
    }

    const remaining = env.OTP_MAX_ATTEMPTS - attempts;
    throw new OtpInvalidError(Math.max(0, remaining));
  }

  // Mark OTP as used
  await authRepo.markOtpUsed(otpLog.id);

  // Clear cooldown
  const cache = getCacheClient();
  await cache.del(`${env.REDIS_KEY_PREFIX}otp:cooldown:${normalizedPhone}`);

  // Upsert user
  let user = await authRepo.findUserByPhone(normalizedPhone);
  let isNewUser = false;

  if (!user) {
    isNewUser = true;
    user = await authRepo.createUser({
      phoneNumber: normalizedPhone,
      legalFullName: 'New User', // will be updated on profile completion
      role: UserRole.TENANT,
    });
  }

  // Update device info and last login
  await authRepo.updateUserProfile(user.id, {
    deviceId: params.deviceId,
  });
  await authRepo.updateUserLastLogin(user.id);

  // Generate token pair
  const tokens = generateTokenPair({
    userId: user.id,
    role: user.account_role,
    phone: user.phone_number,
  });

  // Store refresh token hash in DB
  await authRepo.createRefreshToken({
    userId: user.id,
    tokenHash: hashToken(tokens.refreshToken),
    tokenFamily: tokens.tokenFamily,
    expiresAt: tokens.refreshTokenExpiresAt,
    deviceInfo: params.deviceInfo,
    ipAddress: params.ipAddress,
  });

  logger.info('User authenticated', {
    userId: user.id,
    role: user.account_role,
    isNewUser,
  });

  const { deleted_at: _, ...userWithoutSensitive } = user;
  return {
    ...tokens,
    user: userWithoutSensitive,
    isNewUser,
  };
}

// ─────────────────────────────────────────────
// Refresh Token Rotation
// ─────────────────────────────────────────────

export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
}> {
  // Verify JWT signature first
  const { verifyRefreshToken } = await import('@shared/utils/jwt');
  let payload: Awaited<ReturnType<typeof verifyRefreshToken>>;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new UnauthorizedError('Invalid refresh token');
  }

  const tokenHash = hashToken(refreshToken);

  // Check DB for token existence and revocation
  const tokenRecord = await authRepo.findRefreshToken(refreshToken);

  if (!tokenRecord) {
    // Token not found or already revoked — possible reuse attack
    // Revoke ALL tokens in this family (security measure)
    await authRepo.revokeAllUserTokensInFamily(payload.sub, payload.tokenFamily);
    logger.warn('Refresh token reuse detected — family revoked', {
      userId: payload.sub,
      tokenFamily: payload.tokenFamily,
    });
    throw new UnauthorizedError('Token reuse detected. Please log in again.');
  }

  // Revoke old token (rotation: one-time use)
  await authRepo.revokeRefreshToken(tokenHash, 'ROTATION');

  // Fetch current user
  const user = await authRepo.findUserById(payload.sub);
  if (!user || !user.is_active) {
    throw new UnauthorizedError('User account is inactive');
  }

  // Issue new token pair in the same family
  const tokens = generateTokenPair({
    userId: user.id,
    role: user.account_role,
    phone: user.phone_number,
    tokenFamily: tokenRecord.token_family,
  });

  // Store new refresh token
  await authRepo.createRefreshToken({
    userId: user.id,
    tokenHash: hashToken(tokens.refreshToken),
    tokenFamily: tokens.tokenFamily,
    expiresAt: tokens.refreshTokenExpiresAt,
    deviceInfo: tokenRecord.device_info ?? undefined,
  });

  return tokens;
}

// ─────────────────────────────────────────────
// Logout
// ─────────────────────────────────────────────

export async function logout(userId: string, accessToken?: string): Promise<void> {
  // Revoke all refresh tokens for this user
  await authRepo.revokeAllUserTokens(userId);

  // Blacklist access token if provided
  if (accessToken) {
    const { revokeAccessToken } = await import('@shared/middleware/auth.middleware');
    await revokeAccessToken(accessToken);
  }

  logger.info('User logged out', { userId });
}
