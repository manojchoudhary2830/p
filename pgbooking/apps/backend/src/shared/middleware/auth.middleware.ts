import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '@shared/utils/jwt';
import { getSessionClient } from '@config/redis';
import { InvalidTokenError, UnauthorizedError } from '@shared/errors';
import { logger } from '@shared/utils/logger';

const BEARER_PREFIX = 'Bearer ';

// ─────────────────────────────────────────────
// Token Extraction
// ─────────────────────────────────────────────

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith(BEARER_PREFIX)) return null;
  const token = authHeader.slice(BEARER_PREFIX.length).trim();
  return token || null;
}

// ─────────────────────────────────────────────
// Authenticate Middleware (required)
// ─────────────────────────────────────────────

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = extractBearerToken(req);

    if (!token) {
      throw new UnauthorizedError('No authentication token provided');
    }

    // Verify JWT signature and claims
    const payload = verifyAccessToken(token);

    // Check token blacklist (revoked tokens via logout)
    const sessionClient = getSessionClient();
    const isRevoked = await sessionClient.get(
      `blacklist:jti:${payload.jti}`,
    );

    if (isRevoked) {
      throw new InvalidTokenError('Token has been revoked');
    }

    req.user = {
      id: payload.sub,
      role: payload.role,
      phone: payload.phone,
    };

    next();
  } catch (error) {
    next(error);
  }
}

// ─────────────────────────────────────────────
// Optional Authentication (does not fail if no token)
// ─────────────────────────────────────────────

export async function optionalAuthenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      next();
      return;
    }

    const payload = verifyAccessToken(token);
    const sessionClient = getSessionClient();
    const isRevoked = await sessionClient.get(`blacklist:jti:${payload.jti}`);

    if (!isRevoked) {
      req.user = {
        id: payload.sub,
        role: payload.role,
        phone: payload.phone,
      };
    }
  } catch {
    // Silently ignore auth errors for optional auth
  }
  next();
}

// ─────────────────────────────────────────────
// Token Revocation (for logout)
// ─────────────────────────────────────────────

export async function revokeAccessToken(
  token: string,
  ttlSeconds?: number,
): Promise<void> {
  try {
    const payload = verifyAccessToken(token);
    const sessionClient = getSessionClient();

    // Calculate remaining TTL
    const remainingTTL =
      ttlSeconds ??
      (payload.exp ? Math.max(0, payload.exp - Math.floor(Date.now() / 1000)) : 900);

    if (remainingTTL > 0 && payload.jti) {
      await sessionClient.setex(
        `blacklist:jti:${payload.jti}`,
        remainingTTL,
        '1',
      );
    }
  } catch (error) {
    // If token is already invalid, no need to blacklist
    logger.debug('Token revocation skipped (already invalid)', {
      error: (error as Error).message,
    });
  }
}
