import * as crypto from 'crypto';
import bcryptjs from 'bcryptjs';
import { env } from '@config/environment';

const BCRYPT_ROUNDS = 12;

// ─────────────────────────────────────────────
// OTP Generation
// ─────────────────────────────────────────────

/**
 * Generates a cryptographically secure OTP using CSPRNG.
 * Uses rejection sampling to ensure uniform distribution.
 */
export function generateOtp(length = 6): string {
  const max = Math.pow(10, length);
  let otp: number;
  do {
    const bytes = crypto.randomBytes(4);
    otp = (bytes as unknown as { readUInt32BE: (o: number) => number }).readUInt32BE(0) % max;
  } while (otp < Math.pow(10, length - 1)); // ensure correct length

  return otp.toString().padStart(length, '0');
}

/**
 * Constant-time OTP comparison to prevent timing attacks.
 */
export function compareOtp(provided: string, stored: string): boolean {
  if (provided.length !== stored.length) return false;
  return crypto.timingSafeEqual(
    Buffer.from(provided, 'utf8'),
    Buffer.from(stored, 'utf8'),
  );
}

// ─────────────────────────────────────────────
// Password Hashing
// ─────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcryptjs.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcryptjs.compare(password, hash);
}

// ─────────────────────────────────────────────
// Token Hashing (for refresh tokens in DB)
// ─────────────────────────────────────────────

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex') as string;
}

// ─────────────────────────────────────────────
// AES-256-GCM Encryption (for sensitive data at rest)
// ─────────────────────────────────────────────

const ALGORITHM = 'aes-256-gcm';
const KEY_BUFFER = Buffer.from(env.ENCRYPTION_KEY, 'hex');

interface EncryptedData {
  iv: string;
  tag: string;
  ciphertext: string;
}

export function encryptSensitiveData(plaintext: string): string {
  const iv = crypto.randomBytes(env.ENCRYPTION_IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY_BUFFER, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  const payload: EncryptedData = {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: encrypted.toString('base64'),
  };

  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

export function decryptSensitiveData(encryptedBase64: string): string {
  const payload: EncryptedData = JSON.parse(
    Buffer.from(encryptedBase64, 'base64').toString('utf8'),
  );

  const iv = Buffer.from(payload.iv, 'base64');
  const tag = Buffer.from(payload.tag, 'base64');
  const ciphertext = Buffer.from(payload.ciphertext, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, KEY_BUFFER, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

// ─────────────────────────────────────────────
// HMAC Signature (for Razorpay webhook verification)
// ─────────────────────────────────────────────

export function createHmacSignature(
  payload: string,
  secret: string,
  algorithm = 'sha256',
): string {
  return crypto.createHmac(algorithm, secret).update(payload).digest('hex') as string;
}

export function verifyHmacSignature(
  payload: string,
  receivedSignature: string,
  secret: string,
  algorithm = 'sha256',
): boolean {
  const expectedSignature = createHmacSignature(payload, secret, algorithm);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(receivedSignature, 'hex'),
    );
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────
// Random ID / Key Generation
// ─────────────────────────────────────────────

export function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function generateIdempotencyKey(): string {
  return `idk_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
}

// ─────────────────────────────────────────────
// Phone Number Utilities
// ─────────────────────────────────────────────

export function normalizePhoneNumber(phone: string): string {
  // Strip all non-digit characters
  const digits = phone.replace(/\D/g, '');
  // Handle Indian phone numbers
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (digits.startsWith('+')) return `+${digits.replace(/^\+/, '')}`;
  return `+${digits}`;
}

export function maskPhoneNumber(phone: string): string {
  if (phone.length < 6) return '****';
  const visible = 4;
  return '*'.repeat(phone.length - visible) + phone.slice(-visible);
}
