import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@shared/types';
import { ForbiddenError, InsufficientPermissionsError, UnauthorizedError } from '@shared/errors';

// ─────────────────────────────────────────────
// Role Hierarchy
// ─────────────────────────────────────────────

const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.TENANT]: 1,
  [UserRole.OWNER]: 2,
  [UserRole.SYSTEM_ADMIN]: 3,
};

export function hasMinimumRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

// ─────────────────────────────────────────────
// Role Guard Factory
// ─────────────────────────────────────────────

/**
 * Restricts access to users with one of the specified roles.
 * Automatically ensures authentication occurred first.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(
        new InsufficientPermissionsError(
          allowedRoles.length === 1 ? allowedRoles[0] : allowedRoles.join(' or '),
        ),
      );
      return;
    }

    next();
  };
}

// ─────────────────────────────────────────────
// Specific Role Shortcuts
// ─────────────────────────────────────────────

export const requireTenant = requireRole(UserRole.TENANT);
export const requireOwner = requireRole(UserRole.OWNER);
export const requireAdmin = requireRole(UserRole.SYSTEM_ADMIN);
export const requireOwnerOrAdmin = requireRole(UserRole.OWNER, UserRole.SYSTEM_ADMIN);
export const requireAnyRole = requireRole(UserRole.TENANT, UserRole.OWNER, UserRole.SYSTEM_ADMIN);

// ─────────────────────────────────────────────
// Self or Admin Access
// ─────────────────────────────────────────────

/**
 * Allows access if the authenticated user is either:
 * - The resource owner (their own ID matches req.params.userId)
 * - A SYSTEM_ADMIN
 */
export function requireSelfOrAdmin(userIdParam = 'userId') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }

    const targetUserId = req.params[userIdParam];
    const isSelf = req.user.id === targetUserId;
    const isAdmin = req.user.role === UserRole.SYSTEM_ADMIN;

    if (!isSelf && !isAdmin) {
      next(new ForbiddenError('You can only access your own resources'));
      return;
    }

    next();
  };
}

// ─────────────────────────────────────────────
// Resource Ownership Validator
// ─────────────────────────────────────────────

/**
 * Higher-order function to inject ownership verification into route handlers.
 * Admins bypass ownership checks automatically.
 */
export function ensureOwnership<T extends { owner_id?: string; landlord_owner_id?: string; reported_by_user_id?: string }>(
  fetchResource: (id: string) => Promise<T | null>,
  resourceParam = 'id',
  ownerField: keyof T = 'landlord_owner_id' as keyof T,
) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        next(new UnauthorizedError());
        return;
      }

      // Admins bypass ownership checks
      if (req.user.role === UserRole.SYSTEM_ADMIN) {
        next();
        return;
      }

      const resourceId = req.params[resourceParam];
      const resource = await fetchResource(resourceId);

      if (!resource) {
        next(new ForbiddenError());
        return;
      }

      const ownerId = resource[ownerField] as string | undefined;
      if (ownerId !== req.user.id) {
        next(new ForbiddenError('You do not own this resource'));
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
