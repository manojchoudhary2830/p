import { PoolClient } from 'pg';
import { query, queryOne, withTransaction } from '@config/database';
import { hashToken } from '@shared/utils/crypto';
import { UserRow, RefreshTokenRow, UserRole } from '@shared/types';

// ─────────────────────────────────────────────
// User Operations
// ─────────────────────────────────────────────

export async function findUserByPhone(phone: string): Promise<UserRow | null> {
  return queryOne<UserRow>(
    `SELECT * FROM users WHERE phone_number = $1 AND deleted_at IS NULL LIMIT 1`,
    [phone],
  );
}

export async function findUserById(id: string): Promise<UserRow | null> {
  return queryOne<UserRow>(
    `SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
    [id],
  );
}

export async function createUser(params: {
  phoneNumber: string;
  legalFullName: string;
  role: UserRole;
  emailAddress?: string;
}): Promise<UserRow> {
  const result = await queryOne<UserRow>(
    `INSERT INTO users (phone_number, legal_full_name, account_role, email_address)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [params.phoneNumber, params.legalFullName, params.role, params.emailAddress ?? null],
  );
  if (!result) throw new Error('Failed to create user');
  return result;
}

export async function updateUserProfile(
  userId: string,
  params: { legalFullName?: string; emailAddress?: string; fcmToken?: string; deviceId?: string },
): Promise<UserRow> {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (params.legalFullName !== undefined) {
    setClauses.push(`legal_full_name = $${idx++}`);
    values.push(params.legalFullName);
  }
  if (params.emailAddress !== undefined) {
    setClauses.push(`email_address = $${idx++}`);
    values.push(params.emailAddress);
  }
  if (params.fcmToken !== undefined) {
    setClauses.push(`fcm_token = $${idx++}`);
    values.push(params.fcmToken);
  }
  if (params.deviceId !== undefined) {
    setClauses.push(`device_id = $${idx++}`);
    values.push(params.deviceId);
  }

  if (setClauses.length === 0) {
    const user = await findUserById(userId);
    if (!user) throw new Error('User not found');
    return user;
  }

  setClauses.push(`record_updated_at = NOW()`);
  values.push(userId);

  const result = await queryOne<UserRow>(
    `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${idx} AND deleted_at IS NULL RETURNING *`,
    values,
  );
  if (!result) throw new Error('User not found');
  return result;
}

export async function updateUserLastLogin(userId: string): Promise<void> {
  await query(
    `UPDATE users SET last_login_at = NOW() WHERE id = $1`,
    [userId],
  );
}

// ─────────────────────────────────────────────
// Refresh Token Operations
// ─────────────────────────────────────────────

export async function createRefreshToken(params: {
  userId: string;
  tokenHash: string;
  tokenFamily: string;
  expiresAt: Date;
  deviceInfo?: Record<string, unknown>;
  ipAddress?: string;
}): Promise<void> {
  await query(
    `INSERT INTO refresh_tokens
      (user_id, token_hash, token_family, expires_at, device_info, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      params.userId,
      params.tokenHash,
      params.tokenFamily,
      params.expiresAt,
      params.deviceInfo ? JSON.stringify(params.deviceInfo) : null,
      params.ipAddress ?? null,
    ],
  );
}

export async function findRefreshToken(token: string): Promise<RefreshTokenRow | null> {
  const tokenHash = hashToken(token);
  return queryOne<RefreshTokenRow>(
    `SELECT * FROM refresh_tokens
     WHERE token_hash = $1
       AND is_revoked = FALSE
       AND expires_at > NOW()
     LIMIT 1`,
    [tokenHash],
  );
}

export async function revokeRefreshToken(
  tokenHash: string,
  reason: string,
  client?: PoolClient,
): Promise<void> {
  const sql = `
    UPDATE refresh_tokens
    SET is_revoked = TRUE, revoked_at = NOW(), revocation_reason = $1
    WHERE token_hash = $2
  `;
  if (client) {
    await client.query(sql, [reason, tokenHash]);
  } else {
    await query(sql, [reason, tokenHash]);
  }
}

export async function revokeAllUserTokensInFamily(
  userId: string,
  tokenFamily: string,
): Promise<void> {
  await query(
    `UPDATE refresh_tokens
     SET is_revoked = TRUE, revoked_at = NOW(), revocation_reason = 'SECURITY'
     WHERE user_id = $1 AND token_family = $2 AND is_revoked = FALSE`,
    [userId, tokenFamily],
  );
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  await query(
    `UPDATE refresh_tokens
     SET is_revoked = TRUE, revoked_at = NOW(), revocation_reason = 'LOGOUT'
     WHERE user_id = $1 AND is_revoked = FALSE`,
    [userId],
  );
}

// ─────────────────────────────────────────────
// OTP Log Operations
// ─────────────────────────────────────────────

export async function saveOtpLog(params: {
  phoneNumber: string;
  otpHash: string;
  expiresAt: Date;
  ipAddress?: string;
}): Promise<string> {
  // Invalidate any existing active OTP for this phone
  await query(
    `UPDATE otp_logs
     SET is_used = TRUE, used_at = NOW()
     WHERE phone_number = $1 AND is_used = FALSE AND expires_at > NOW()`,
    [params.phoneNumber],
  );

  const result = await queryOne<{ id: string }>(
    `INSERT INTO otp_logs (phone_number, otp_hash, expires_at, ip_address)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [params.phoneNumber, params.otpHash, params.expiresAt, params.ipAddress ?? null],
  );
  if (!result) throw new Error('Failed to save OTP log');
  return result.id;
}

export async function getActiveOtpLog(phoneNumber: string): Promise<{
  id: string;
  otp_hash: string;
  attempts: number;
  is_locked: boolean;
  lock_expires_at: Date | null;
  expires_at: Date;
} | null> {
  return queryOne(
    `SELECT id, otp_hash, attempts, is_locked, lock_expires_at, expires_at
     FROM otp_logs
     WHERE phone_number = $1
       AND is_used = FALSE
       AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [phoneNumber],
  );
}

export async function incrementOtpAttempt(otpLogId: string, maxAttempts: number): Promise<{
  attempts: number;
  shouldLock: boolean;
}> {
  const result = await queryOne<{ attempts: number }>(
    `UPDATE otp_logs
     SET attempts = attempts + 1
     WHERE id = $1
     RETURNING attempts`,
    [otpLogId],
  );
  const attempts = result?.attempts ?? 1;
  const shouldLock = attempts >= maxAttempts;
  return { attempts, shouldLock };
}

export async function lockOtp(otpLogId: string, lockDurationSeconds: number): Promise<void> {
  await query(
    `UPDATE otp_logs
     SET is_locked = TRUE,
         lock_expires_at = NOW() + INTERVAL '1 second' * $2
     WHERE id = $1`,
    [otpLogId, lockDurationSeconds],
  );
}

export async function markOtpUsed(otpLogId: string): Promise<void> {
  await query(
    `UPDATE otp_logs SET is_used = TRUE, used_at = NOW() WHERE id = $1`,
    [otpLogId],
  );
}
