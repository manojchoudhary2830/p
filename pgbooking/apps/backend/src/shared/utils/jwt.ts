import jwt from 'jsonwebtoken';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { env } from '@config/environment';
import { JwtPayload, RefreshTokenPayload, UserRole } from '@shared/types';
import { InvalidTokenError, TokenExpiredError } from '@shared/errors';
import { logger } from './logger';

// ─────────────────────────────────────────────
// Key Loading (cached)
// ─────────────────────────────────────────────

let privateKey: string | null = null;
let publicKey: string | null = null;

function getPrivateKey(): string {
  if (!privateKey) {
    // Cloud deployments (e.g. Koyeb) pass key content directly via env var
    if (process.env.JWT_PRIVATE_KEY) {
      privateKey = process.env.JWT_PRIVATE_KEY.replace(/\\n/g, '\n');
      return privateKey;
    }
    // Traditional deployments read from file path
    try {
      privateKey = (fs.readFileSync(path.resolve(env.JWT_PRIVATE_KEY_PATH), 'utf8') as string);
      if (!privateKey) throw new Error('Could not read private key file');
    } catch (error) {
      throw new Error(`Failed to load JWT private key. Set JWT_PRIVATE_KEY env var or check JWT_PRIVATE_KEY_PATH: ${(error as Error).message}`);
    }
  }
  return privateKey;
} private key from ${env.JWT_PRIVATE_KEY_PATH}: ${(error as Error).message}`);
    }
  }
  return privateKey;
}

function getPublicKey(): string {
  if (!publicKey) {
    if (process.env.JWT_PUBLIC_KEY) {
      publicKey = process.env.JWT_PUBLIC_KEY.replace(/\\n/g, '\n');
      return publicKey;
    }
    try {
      publicKey = (fs.readFileSync(path.resolve(env.JWT_PUBLIC_KEY_PATH), 'utf8') as string);
      if (!publicKey) throw new Error('Could not read public key file');
    } catch (error) {
      throw new Error(`Failed to load JWT public key from ${env.JWT_PUBLIC_KEY_PATH}: ${(error as Error).message}`);
    }
  }
  return publicKey;
}

// ─────────────────────────────────────────────
// Access Token
// ─────────────────────────────────────────────

export function signAccessToken(payload: {
  userId: string;
  role: UserRole;
  phone: string;
}): string {
  const jti = uuidv4();

  return jwt.sign(
    {
      sub: payload.userId,
      role: payload.role,
      phone: payload.phone,
      jti,
    } satisfies Omit<JwtPayload, 'iat' | 'exp'>,
    getPrivateKey(),
    {
      algorithm: 'RS256',
      expiresIn: env.JWT_ACCESS_TOKEN_EXPIRY,
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    },
  );
}

export function verifyAccessToken(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, getPublicKey(), {
      algorithms: ['RS256'],
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    }) as JwtPayload;

    return decoded;
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    if (error instanceof jwt.TokenExpiredError) {
      throw new TokenExpiredError();
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new InvalidTokenError(error.message);
    }
    throw new InvalidTokenError('Token verification failed');
  }
}

export function decodeTokenWithoutVerification(token: string): JwtPayload | null {
  try {
    return jwt.decode(token) as JwtPayload | null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// Refresh Token
// ─────────────────────────────────────────────

export function signRefreshToken(payload: {
  userId: string;
  tokenFamily: string;
}): { token: string; jti: string } {
  const jti = uuidv4();

  const token = jwt.sign(
    {
      sub: payload.userId,
      tokenFamily: payload.tokenFamily,
      jti,
    } satisfies Omit<RefreshTokenPayload, never>,
    getPrivateKey(),
    {
      algorithm: 'RS256',
      expiresIn: env.JWT_REFRESH_TOKEN_EXPIRY,
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    },
  );

  return { token, jti };
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    const decoded = jwt.verify(token, getPublicKey(), {
      algorithms: ['RS256'],
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    }) as RefreshTokenPayload;

    return decoded;
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    if (error instanceof jwt.TokenExpiredError) {
      throw new TokenExpiredError();
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new InvalidTokenError(error.message);
    }
    throw new InvalidTokenError('Refresh token verification failed');
  }
}

// ─────────────────────────────────────────────
// Token Pair Generation
// ─────────────────────────────────────────────

export function generateTokenPair(params: {
  userId: string;
  role: UserRole;
  phone: string;
  tokenFamily?: string;
}): {
  accessToken: string;
  refreshToken: string;
  refreshTokenJti: string;
  tokenFamily: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
} {
  const tokenFamily = params.tokenFamily ?? uuidv4();
  const accessToken = signAccessToken({
    userId: params.userId,
    role: params.role,
    phone: params.phone,
  });
  const { token: refreshToken, jti: refreshTokenJti } = signRefreshToken({
    userId: params.userId,
    tokenFamily,
  });

  // Parse expiry durations for response
  const accessTokenMs = parseExpiryToMs(env.JWT_ACCESS_TOKEN_EXPIRY);
  const refreshTokenMs = parseExpiryToMs(env.JWT_REFRESH_TOKEN_EXPIRY);

  return {
    accessToken,
    refreshToken,
    refreshTokenJti,
    tokenFamily,
    accessTokenExpiresAt: new Date(Date.now() + accessTokenMs),
    refreshTokenExpiresAt: new Date(Date.now() + refreshTokenMs),
  };
}

// ─────────────────────────────────────────────
// Helper: Parse expiry string to milliseconds
// ─────────────────────────────────────────────

function parseExpiryToMs(expiry: string): number {
  const units: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
  };
  const match = expiry.match(/^(\d+)([smhdw])$/);
  if (!match) throw new Error(`Invalid expiry format: ${expiry}`);
  return parseInt(match[1], 10) * (units[match[2]] ?? 1000);
}

// ─────────────────────────────────────────────
// Key Generation Utility (CLI usage)
// ─────────────────────────────────────────────

export async function generateRsaKeyPair(outputDir: string): Promise<void> {
  const { generateKeyPairSync } = await import('crypto');
  const { privateKey: priv, publicKey: pub } = generateKeyPairSync('rsa', {
    modulusLength: 4096,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const keysDir = path.resolve(outputDir, 'keys');
  fs.mkdirSync(keysDir, { recursive: true });
  fs.writeFileSync(path.join(keysDir, 'private.pem'), priv, { mode: 0o600 });
  fs.writeFileSync(path.join(keysDir, 'public.pem'), pub, { mode: 0o644 });

  logger.info('✅ RSA key pair generated', { outputDir: keysDir });
}
