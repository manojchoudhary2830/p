import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { Request, Response, NextFunction } from 'express';
import { getCacheClient } from '@config/redis';
import { env } from '@config/environment';
import { RateLimitError } from '@shared/errors';
import { ApiResponse } from '@shared/types';

function buildRateLimitHandler() {
  return (_req: Request, res: Response) => {
    const response: ApiResponse = {
      status: 'error',
      message: 'Too many requests. Please slow down and try again later.',
    };
    res.status(429).json(response);
  };
}

function buildRedisStore(prefix: string) {
  return new RedisStore({
    sendCommand: (...args: string[]) => getCacheClient().call(...args),
    prefix: `${env.REDIS_KEY_PREFIX}rl:${prefix}:`,
  });
}

// ─────────────────────────────────────────────
// Global API Rate Limiter
// ─────────────────────────────────────────────

export const globalRateLimit = rateLimit({
  windowMs: env.RATE_LIMIT_GLOBAL_WINDOW_MS,
  max: env.RATE_LIMIT_GLOBAL_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  store: buildRedisStore('global'),
  handler: buildRateLimitHandler(),
  keyGenerator: (req: any) => {
    return req.user?.id ?? req.ip ?? 'anonymous';
  },
  skip: (req: any) => {
    // Skip health check endpoints
    return req.path === '/health' || req.path === '/metrics';
  },
});

// ─────────────────────────────────────────────
// Auth Endpoint Rate Limiter (strict)
// ─────────────────────────────────────────────

export const authRateLimit = rateLimit({
  windowMs: env.RATE_LIMIT_AUTH_WINDOW_MS,
  max: env.RATE_LIMIT_AUTH_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  store: buildRedisStore('auth'),
  handler: buildRateLimitHandler(),
  keyGenerator: (req: any) => {
    // Rate limit by phone number + IP for auth endpoints
    const phone = (req.body?.phone_number as string) ?? req.ip ?? 'anonymous';
    return `${phone}:${req.ip ?? ''}`;
  },
});

// ─────────────────────────────────────────────
// OTP Request Rate Limiter (very strict)
// ─────────────────────────────────────────────

export const otpRateLimit = rateLimit({
  windowMs: env.RATE_LIMIT_OTP_WINDOW_MS,
  max: env.RATE_LIMIT_OTP_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  store: buildRedisStore('otp'),
  handler: buildRateLimitHandler(),
  keyGenerator: (req: any) => {
    return (req.body?.phone_number as string) ?? req.ip ?? 'anonymous';
  },
});

// ─────────────────────────────────────────────
// Search Endpoint Rate Limiter
// ─────────────────────────────────────────────

export const searchRateLimit = rateLimit({
  windowMs: 60 * 1000,     // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  store: buildRedisStore('search'),
  handler: buildRateLimitHandler(),
  keyGenerator: (req: any) => req.user?.id ?? req.ip ?? 'anonymous',
});

// ─────────────────────────────────────────────
// Upload Rate Limiter
// ─────────────────────────────────────────────

export const uploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: buildRedisStore('upload'),
  handler: buildRateLimitHandler(),
  keyGenerator: (req: any) => req.user?.id ?? req.ip ?? 'anonymous',
});

// ─────────────────────────────────────────────
// Payment Endpoint Rate Limiter
// ─────────────────────────────────────────────

export const paymentRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: buildRedisStore('payment'),
  handler: buildRateLimitHandler(),
  keyGenerator: (req: any) => req.user?.id ?? req.ip ?? 'anonymous',
});
