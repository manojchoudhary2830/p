import { ValidationError } from '@shared/types';

// ─────────────────────────────────────────────
// Base Application Error
// ─────────────────────────────────────────────

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly errorCode: string;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode = 500,
    errorCode = 'INTERNAL_ERROR',
    isOperational = true,
    details?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.errorCode = errorCode;
    this.details = details;

    // Maintain proper stack trace (V8 only)
    if ((Error as unknown as { captureStackTrace?: (t: object, c: Function) => void }).captureStackTrace) {
      (Error as unknown as { captureStackTrace: (t: object, c: Function) => void }).captureStackTrace(this, this.constructor);
    }
  }
}

// ─────────────────────────────────────────────
// 400 Bad Request
// ─────────────────────────────────────────────

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', errorCode = 'BAD_REQUEST', details?: unknown) {
    super(message, 400, errorCode, true, details);
  }
}

export class ValidationFailedError extends AppError {
  public readonly validationErrors: ValidationError[];

  constructor(errors: ValidationError[], message = 'Validation failed') {
    super(message, 422, 'VALIDATION_FAILED', true, errors);
    this.validationErrors = errors;
  }
}

// ─────────────────────────────────────────────
// 401 Unauthorized
// ─────────────────────────────────────────────

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', errorCode = 'UNAUTHORIZED') {
    super(message, 401, errorCode, true);
  }
}

export class InvalidTokenError extends AppError {
  constructor(message = 'Invalid or expired token') {
    super(message, 401, 'INVALID_TOKEN', true);
  }
}

export class TokenExpiredError extends AppError {
  constructor() {
    super('Token has expired', 401, 'TOKEN_EXPIRED', true);
  }
}

// ─────────────────────────────────────────────
// 403 Forbidden
// ─────────────────────────────────────────────

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied', errorCode = 'FORBIDDEN') {
    super(message, 403, errorCode, true);
  }
}

export class InsufficientPermissionsError extends AppError {
  constructor(requiredRole?: string) {
    super(
      requiredRole
        ? `This action requires ${requiredRole} role`
        : 'Insufficient permissions',
      403,
      'INSUFFICIENT_PERMISSIONS',
      true,
    );
  }
}

// ─────────────────────────────────────────────
// 404 Not Found
// ─────────────────────────────────────────────

export class NotFoundError extends AppError {
  constructor(resource = 'Resource', id?: string) {
    super(
      id ? `${resource} with ID '${id}' not found` : `${resource} not found`,
      404,
      'NOT_FOUND',
      true,
    );
  }
}

// ─────────────────────────────────────────────
// 409 Conflict
// ─────────────────────────────────────────────

export class ConflictError extends AppError {
  constructor(message: string, errorCode = 'CONFLICT') {
    super(message, 409, errorCode, true);
  }
}

export class BedAlreadyReservedError extends AppError {
  constructor(bedId: string) {
    super(
      `Bed '${bedId}' is currently being reserved by another user. Please try again.`,
      409,
      'BED_ALREADY_RESERVED',
      true,
    );
  }
}

export class DoubleBookingError extends AppError {
  constructor() {
    super(
      'This bed is no longer available. Please select a different bed.',
      409,
      'DOUBLE_BOOKING_PREVENTED',
      true,
    );
  }
}

export class DuplicatePaymentError extends AppError {
  constructor(idempotencyKey: string) {
    super(
      'A payment with this idempotency key already exists.',
      409,
      'DUPLICATE_PAYMENT',
      true,
      { idempotencyKey },
    );
  }
}

// ─────────────────────────────────────────────
// 410 Gone
// ─────────────────────────────────────────────

export class ReservationExpiredError extends AppError {
  constructor() {
    super(
      'Your reservation has expired. Please start the booking process again.',
      410,
      'RESERVATION_EXPIRED',
      true,
    );
  }
}

// ─────────────────────────────────────────────
// 422 Unprocessable Entity
// ─────────────────────────────────────────────

export class OtpInvalidError extends AppError {
  constructor(attemptsRemaining?: number) {
    super(
      attemptsRemaining !== undefined
        ? `Invalid OTP. ${attemptsRemaining} attempt(s) remaining.`
        : 'Invalid or expired OTP.',
      422,
      'OTP_INVALID',
      true,
      { attemptsRemaining },
    );
  }
}

export class OtpExpiredError extends AppError {
  constructor() {
    super('OTP has expired. Please request a new one.', 422, 'OTP_EXPIRED', true);
  }
}

export class OtpLockedError extends AppError {
  constructor(lockoutSeconds: number) {
    super(
      `Too many failed attempts. Please try again in ${Math.ceil(lockoutSeconds / 60)} minute(s).`,
      429,
      'OTP_LOCKED',
      true,
      { lockoutSeconds },
    );
  }
}

// ─────────────────────────────────────────────
// 429 Too Many Requests
// ─────────────────────────────────────────────

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests. Please slow down.') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', true);
  }
}

// ─────────────────────────────────────────────
// 500 Internal Server Error
// ─────────────────────────────────────────────

export class InternalServerError extends AppError {
  constructor(message = 'An unexpected error occurred', cause?: Error) {
    super(message, 500, 'INTERNAL_ERROR', false, cause?.message);
  }
}

export class DatabaseError extends AppError {
  constructor(message = 'Database operation failed') {
    super(message, 500, 'DATABASE_ERROR', false);
  }
}

export class ExternalServiceError extends AppError {
  constructor(serviceName: string, message?: string) {
    super(
      message ?? `External service '${serviceName}' is unavailable`,
      503,
      'EXTERNAL_SERVICE_ERROR',
      true,
    );
  }
}

// ─────────────────────────────────────────────
// Payment Errors
// ─────────────────────────────────────────────

export class PaymentVerificationError extends AppError {
  constructor(message = 'Payment signature verification failed') {
    super(message, 400, 'PAYMENT_VERIFICATION_FAILED', true);
  }
}

export class PaymentGatewayError extends AppError {
  constructor(message: string) {
    super(message, 502, 'PAYMENT_GATEWAY_ERROR', true);
  }
}

// ─────────────────────────────────────────────
// KYC Errors
// ─────────────────────────────────────────────

export class KycRequiredError extends AppError {
  constructor() {
    super(
      'KYC verification is required before making a booking.',
      403,
      'KYC_REQUIRED',
      true,
    );
  }
}

// ─────────────────────────────────────────────
// Type Guard
// ─────────────────────────────────────────────

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function isOperationalError(error: unknown): boolean {
  if (isAppError(error)) return error.isOperational;
  return false;
}
