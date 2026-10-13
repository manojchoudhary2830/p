import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import {
  AppError,
  ValidationFailedError,
  isAppError,
} from '@shared/errors';
import { ApiResponse, ValidationError } from '@shared/types';
import { logger } from '@shared/utils/logger';

// ─────────────────────────────────────────────
// PostgreSQL Error Codes
// ─────────────────────────────────────────────

const PG_UNIQUE_VIOLATION = '23505';
const PG_FOREIGN_KEY_VIOLATION = '23503';
const PG_NOT_NULL_VIOLATION = '23502';
const PG_CHECK_VIOLATION = '23514';

interface PgError extends Error {
  code?: string;
  constraint?: string;
  detail?: string;
  column?: string;
  table?: string;
}

// ─────────────────────────────────────────────
// Zod Validation Error Formatter
// ─────────────────────────────────────────────

function formatZodErrors(error: ZodError): ValidationError[] {
  return error.errors.map((issue: any) => ({
    field: issue.path.join('.') || 'root',
    message: issue.message,
    code: issue.code,
  }));
}

// ─────────────────────────────────────────────
// PostgreSQL Error Mapper
// ─────────────────────────────────────────────

function mapPgError(err: PgError): AppError {
  switch (err.code) {
    case PG_UNIQUE_VIOLATION:
      return new AppError(
        `A record with this value already exists${err.constraint ? ` (${err.constraint})` : ''}`,
        409,
        'DUPLICATE_RECORD',
      );
    case PG_FOREIGN_KEY_VIOLATION:
      return new AppError(
        'Referenced resource does not exist',
        400,
        'FOREIGN_KEY_VIOLATION',
      );
    case PG_NOT_NULL_VIOLATION:
      return new AppError(
        `Required field '${err.column}' is missing`,
        400,
        'MISSING_REQUIRED_FIELD',
      );
    case PG_CHECK_VIOLATION:
      return new AppError(
        'Data constraint violation',
        400,
        'CONSTRAINT_VIOLATION',
      );
    default:
      return new AppError('Database operation failed', 500, 'DATABASE_ERROR', false);
  }
}

// ─────────────────────────────────────────────
// Global Error Handler
// ─────────────────────────────────────────────

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = req.requestId ?? 'unknown';

  // ── Zod validation errors ────────────────────
  if (err instanceof ZodError) {
    const validationErrors = formatZodErrors(err);
    logger.warn('Validation error', { requestId, errors: validationErrors });
    const response: ApiResponse = {
      status: 'error',
      message: 'Validation failed',
      errors: validationErrors,
    };
    res.status(422).json(response);
    return;
  }

  // ── ValidationFailedError (manual) ──────────
  if (err instanceof ValidationFailedError) {
    const response: ApiResponse = {
      status: 'error',
      message: err.message,
      errors: err.validationErrors,
    };
    res.status(422).json(response);
    return;
  }

  // ── Known operational AppErrors ─────────────
  if (isAppError(err)) {
    if (err.statusCode >= 500) {
      logger.error('Operational server error', {
        requestId,
        errorCode: err.errorCode,
        message: err.message,
        stack: err.stack,
      });
    } else {
      logger.warn('Client error', {
        requestId,
        statusCode: err.statusCode,
        errorCode: err.errorCode,
        message: err.message,
      });
    }

    const response: ApiResponse = {
      status: 'error',
      message: err.message,
      ...(err.details ? { meta: { details: err.details as Record<string, unknown> } } : {}),
    };
    res.status(err.statusCode).json(response);
    return;
  }

  // ── PostgreSQL errors ────────────────────────
  const pgErr = err as PgError;
  if (pgErr.code && pgErr.code.match(/^\d{5}$/)) {
    const mappedError = mapPgError(pgErr);
    logger.warn('Database constraint error', {
      requestId,
      pgCode: pgErr.code,
      constraint: pgErr.constraint,
      detail: pgErr.detail,
    });
    const response: ApiResponse = {
      status: 'error',
      message: mappedError.message,
    };
    res.status(mappedError.statusCode).json(response);
    return;
  }

  // ── JWT errors (should be caught by auth middleware, but fallback) ──
  const jwtErr = err as Error;
  if (jwtErr.name === 'JsonWebTokenError' || jwtErr.name === 'TokenExpiredError') {
    const response: ApiResponse = {
      status: 'error',
      message: 'Invalid or expired token',
    };
    res.status(401).json(response);
    return;
  }

  // ── Unknown / unhandled errors ───────────────
  logger.error('Unhandled error', {
    requestId,
    error: jwtErr.message,
    stack: jwtErr.stack,
    path: req.path,
    method: req.method,
  });

  const IS_PRODUCTION = process.env.NODE_ENV === 'production';
  const response: ApiResponse = {
    status: 'error',
    message: IS_PRODUCTION ? 'An unexpected error occurred' : (jwtErr.message ?? 'Unknown error'),
    ...(!IS_PRODUCTION && jwtErr.stack ? { meta: { stack: jwtErr.stack } } : {}),
  };
  res.status(500).json(response);
}

// ─────────────────────────────────────────────
// 404 Handler (register after all routes)
// ─────────────────────────────────────────────

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    status: 'error',
    message: `Route '${req.method} ${req.originalUrl}' not found`,
  } satisfies ApiResponse);
}
