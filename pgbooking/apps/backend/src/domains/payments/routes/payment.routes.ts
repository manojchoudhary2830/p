import { Request, Response, Router } from 'express';
import express from 'express';
import { z } from 'zod';
import * as paymentService from '../services/payment.service';
import { sendSuccess, sendCreated, buildPaginatedResult, sendPaginated } from '@shared/utils/response';
import { validateBody } from '@shared/middleware/validation.middleware';
import { authenticate } from '@shared/middleware/auth.middleware';
import { requireTenant, requireOwnerOrAdmin } from '@shared/middleware/rbac.middleware';
import { paymentRateLimit } from '@shared/middleware/rate-limit.middleware';
import { auditLog } from '@shared/middleware/audit.middleware';
import { PaymentPurpose, UserRole } from '@shared/types';
import { BadRequestError, UnauthorizedError } from '@shared/errors';

// ─────────────────────────────────────────────
// Validators
// ─────────────────────────────────────────────

const CreateOrderSchema = z.object({
  booking_id: z.string().uuid(),
  purpose: z.nativeEnum(PaymentPurpose).default(PaymentPurpose.TOKEN_DEPOSIT),
  idempotency_key: z.string().max(100).optional(),
});

const VerifyPaymentSchema = z.object({
  razorpay_order_id: z.string(),
  razorpay_payment_id: z.string(),
  razorpay_signature: z.string(),
  booking_id: z.string().uuid(),
});

const RefundSchema = z.object({
  payment_id: z.string().uuid(),
  amount: z.number().positive().optional(),
  reason: z.string().trim().min(3).max(300),
});

// ─────────────────────────────────────────────
// Controllers
// ─────────────────────────────────────────────

async function createOrder(req: Request, res: Response) {
  const { booking_id, purpose, idempotency_key } = req.body as z.infer<typeof CreateOrderSchema>;

  // Get booking amount from DB
  const { queryOne } = await import('@config/database');
  const booking = await queryOne<{ token_deposit_amount: string; monthly_rent_amount: string; tenant_user_id: string }>(
    `SELECT bk.monthly_rent_amount, bk.tenant_user_id,
            r.token_deposit_amount
     FROM bookings bk
     JOIN beds b ON b.id = bk.assigned_bed_id
     JOIN rooms r ON r.id = b.room_parent_id
     WHERE bk.id = $1 AND bk.deleted_at IS NULL`,
    [booking_id],
  );

  if (!booking) throw new BadRequestError('Booking not found');
  if (booking.tenant_user_id !== req.user!.id) throw new UnauthorizedError();

  const amount = purpose === PaymentPurpose.TOKEN_DEPOSIT
    ? parseFloat(booking.token_deposit_amount)
    : parseFloat(booking.monthly_rent_amount);

  const result = await paymentService.createPaymentOrder({
    bookingId: booking_id,
    payerId: req.user!.id,
    amount,
    currency: 'INR',
    purpose,
    idempotencyKey: idempotency_key,
  });

  sendCreated(res, result, 'Payment order created');
}

async function verifyPayment(req: Request, res: Response) {
  const body = req.body as z.infer<typeof VerifyPaymentSchema>;
  const payment = await paymentService.verifyAndCapturePayment({
    razorpayOrderId: body.razorpay_order_id,
    razorpayPaymentId: body.razorpay_payment_id,
    razorpaySignature: body.razorpay_signature,
    bookingId: body.booking_id,
    payerId: req.user!.id,
  });

  sendSuccess(res, {
    payment_id: payment.id,
    status: payment.transaction_clearance_status,
    amount: payment.exact_financial_amount,
    timestamp: payment.transaction_timestamp,
  }, 'Payment verified successfully');
}

async function getMyPayments(req: Request, res: Response) {
  const page = parseInt(req.query.page as string ?? '1', 10);
  const limit = parseInt(req.query.limit as string ?? '20', 10);
  const { rows, total } = await paymentService.getTenantPaymentHistory(req.user!.id, page, limit);
  sendPaginated(res, buildPaginatedResult(rows, total, { page, limit }));
}

async function getBookingPayments(req: Request, res: Response) {
  const payments = await paymentService.getBookingPayments(req.params.bookingId);
  sendSuccess(res, payments);
}

async function initiateRefund(req: Request, res: Response) {
  const body = req.body as z.infer<typeof RefundSchema>;
  await paymentService.initiateRefund({
    paymentId: body.payment_id,
    amount: body.amount,
    reason: body.reason,
    requestedBy: req.user!.id,
  });
  sendSuccess(res, null, 'Refund initiated');
}

// Razorpay webhook — needs raw body for HMAC verification
async function razorpayWebhook(req: Request, res: Response) {
  const signature = req.headers['x-razorpay-signature'] as string;
  if (!signature) {
    res.status(400).json({ error: 'Missing signature header' });
    return;
  }

  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody?.toString('utf8') ?? JSON.stringify(req.body);

  const result = await paymentService.processWebhook(rawBody, signature);
  res.status(200).json({ status: 'ok', processed: result.processed });
}

// ─────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────

export const paymentRouter = Router();

// Webhook (no auth, raw body required)
paymentRouter.post(
  '/webhook/razorpay',
  express.raw({ type: 'application/json' }),
  razorpayWebhook,
);

// Tenant: create order
paymentRouter.post(
  '/orders',
  authenticate,
  requireTenant,
  paymentRateLimit,
  validateBody(CreateOrderSchema),
  auditLog('PAYMENT:ORDER_CREATE'),
  createOrder,
);

// Tenant: verify payment after Razorpay redirect
paymentRouter.post(
  '/verify',
  authenticate,
  requireTenant,
  validateBody(VerifyPaymentSchema),
  auditLog('PAYMENT:VERIFY'),
  verifyPayment,
);

// Tenant: payment history
paymentRouter.get('/mine', authenticate, getMyPayments);

// Booking payments
paymentRouter.get('/bookings/:bookingId', authenticate, getBookingPayments);

// Admin: refund
paymentRouter.post(
  '/refund',
  authenticate,
  requireOwnerOrAdmin,
  validateBody(RefundSchema),
  auditLog('PAYMENT:REFUND'),
  initiateRefund,
);
