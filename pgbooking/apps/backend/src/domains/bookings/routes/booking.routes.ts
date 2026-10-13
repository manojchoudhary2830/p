import { Request, Response, Router } from 'express';
import * as bookingService from '../services/booking.service';
import {
  InitiateBookingSchema,
  CancelBookingSchema,
  BookingIdParamSchema,
  CheckoutBookingSchema,
} from '../validators/booking.validator';
import { sendSuccess, sendCreated, sendPaginated, parsePaginationParams } from '@shared/utils/response';
import { validateBody, validateParams, validateQuery } from '@shared/middleware/validation.middleware';
import { authenticate } from '@shared/middleware/auth.middleware';
import { requireTenant, requireOwner, requireOwnerOrAdmin } from '@shared/middleware/rbac.middleware';
import { auditLog } from '@shared/middleware/audit.middleware';
import { UserRole, BookingStatus } from '@shared/types';
import { z } from 'zod';

// ─────────────────────────────────────────────
// Controllers
// ─────────────────────────────────────────────

async function initiateBooking(req: Request, res: Response) {
  const idempotencyKey = req.headers['x-idempotency-key'] as string | undefined;
  const body = { ...req.body, idempotency_key: idempotencyKey ?? req.body.idempotency_key };

  const result = await bookingService.initiateBooking(req.user!.id, body);

  sendCreated(res, {
    booking_id: result.bookingId,
    lock_expiration_timestamp: result.lockExpirationTimestamp,
    required_token_amount: result.requiredTokenAmount,
    monthly_rent: result.monthlyRent,
    security_deposit: result.securityDeposit,
    property_name: result.propertyName,
    room_code: result.roomCode,
    bed_code: result.bedCode,
  }, 'Booking initialized. Complete payment within 10 minutes.');
}

async function getMyBookings(req: Request, res: Response) {
  const pagination = parsePaginationParams(req.query as Record<string, string>);
  const result = await bookingService.getTenantBookings(req.user!.id, pagination);
  sendPaginated(res, result);
}

async function getBookingById(req: Request, res: Response) {
  const isAdmin = req.user!.role === UserRole.SYSTEM_ADMIN;
  const booking = await bookingService.getBooking(req.params.id, req.user!.id, isAdmin);
  sendSuccess(res, booking);
}

async function cancelBooking(req: Request, res: Response) {
  const isAdmin = req.user!.role === UserRole.SYSTEM_ADMIN;
  await bookingService.cancelBooking(req.params.id, req.user!.id, isAdmin, req.body);
  sendSuccess(res, null, 'Booking cancelled');
}

async function getOwnerBookings(req: Request, res: Response) {
  const pagination = parsePaginationParams(req.query as Record<string, string>);
  const statusParam = req.query.status as BookingStatus | undefined;
  const result = await bookingService.getOwnerBookings(req.user!.id, pagination, statusParam);
  sendPaginated(res, result);
}

async function checkoutBooking(req: Request, res: Response) {
  await bookingService.checkoutBooking(
    req.params.id,
    req.user!.id,
    req.body.actual_check_out_date,
    req.body.checkout_notes,
  );
  sendSuccess(res, null, 'Tenant checked out successfully');
}

// ─────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────

export const bookingRouter = Router();

// Tenant: initiate booking
bookingRouter.post(
  '/',
  authenticate,
  requireTenant,
  validateBody(InitiateBookingSchema),
  auditLog('BOOKING:INITIATE'),
  initiateBooking,
);

// Tenant: my bookings
bookingRouter.get('/mine', authenticate, getMyBookings);

// Owner: all bookings for their properties
bookingRouter.get(
  '/owner',
  authenticate,
  requireOwner,
  getOwnerBookings,
);

// Shared: get booking by ID
bookingRouter.get(
  '/:id',
  authenticate,
  validateParams(BookingIdParamSchema),
  getBookingById,
);

// Tenant or Admin: cancel booking
bookingRouter.post(
  '/:id/cancel',
  authenticate,
  validateParams(BookingIdParamSchema),
  validateBody(CancelBookingSchema),
  auditLog('BOOKING:CANCEL'),
  cancelBooking,
);

// Owner: checkout tenant
bookingRouter.post(
  '/:id/checkout',
  authenticate,
  requireOwnerOrAdmin,
  validateParams(BookingIdParamSchema),
  validateBody(CheckoutBookingSchema),
  auditLog('BOOKING:CHECKOUT'),
  checkoutBooking,
);
