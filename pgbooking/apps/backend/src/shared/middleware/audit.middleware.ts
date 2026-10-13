import { Request, Response, NextFunction } from 'express';
import { query } from '@config/database';
import { logger } from '@shared/utils/logger';

const AUDITABLE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const SENSITIVE_FIELDS = new Set([
  'password', 'otp', 'token', 'secret', 'key',
  'credit_card', 'cvv', 'pan', 'aadhaar',
]);

function sanitizeBody(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body;
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    sanitized[key] = SENSITIVE_FIELDS.has(key.toLowerCase()) ? '[REDACTED]' : value;
  }
  return sanitized;
}

export function auditLog(action?: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!AUDITABLE_METHODS.has(req.method)) {
      next();
      return;
    }

    // Hook into response finish to capture the result
    const originalJson = res.json.bind(res);
    res.json = function (body: unknown) {
      // Fire-and-forget audit log after response
      if (req.user) {
        const resolvedAction =
          action ??
          `${req.method}:${req.route?.path ?? req.path}`;

        query(
          `INSERT INTO audit_logs
            (user_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            req.user.id,
            resolvedAction,
            extractEntityType(req.path),
            extractEntityId(req.params),
            null,
            sanitizeBody(req.body),
            req.ip ?? null,
            req.headers['user-agent'] ?? null,
          ],
        ).catch((err: Error) => {
          logger.error('Failed to write audit log', { error: err.message });
        });
      }

      return originalJson(body);
    };

    next();
  };
}

function extractEntityType(path: string): string {
  const segments = path.split('/').filter(Boolean);
  // Find the first non-version segment: /api/v1/bookings/... -> 'bookings'
  const versionIndex = segments.findIndex((s) => s.startsWith('v'));
  return segments[versionIndex + 1] ?? 'unknown';
}

function extractEntityId(params: Record<string, string>): string | null {
  return params.id ?? params.bookingId ?? params.propertyId ?? null;
}
