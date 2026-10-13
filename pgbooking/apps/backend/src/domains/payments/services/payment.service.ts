import Razorpay from 'razorpay';
import { v4 as uuidv4 } from 'uuid';
import { env } from '@config/environment';
import { query, queryOne, withTransaction } from '@config/database';
import { createHmacSignature, verifyHmacSignature } from '@shared/utils/crypto';
import { logger } from '@shared/utils/logger';
import {
  PaymentVerificationError, PaymentGatewayError,
  NotFoundError, DuplicatePaymentError, BadRequestError,
} from '@shared/errors';
import { PaymentStatus, PaymentPurpose, PaymentRow } from '@shared/types';
import { confirmBooking } from '@domains/bookings/services/booking.service';
import { dispatchPush, dispatchEmail } from '@infrastructure/queue/bullmq.client';

// ─────────────────────────────────────────────
// Razorpay Client
// ─────────────────────────────────────────────

let razorpayClient: Razorpay | null = null;

function getRazorpay(): Razorpay {
  if (!razorpayClient) {
    razorpayClient = new Razorpay({
      key_id: env.RAZORPAY_KEY_ID,
      key_secret: env.RAZORPAY_KEY_SECRET,
    });
  }
  return razorpayClient;
}

// ─────────────────────────────────────────────
// Create Razorpay Order
// ─────────────────────────────────────────────

export async function createPaymentOrder(params: {
  bookingId: string;
  payerId: string;
  amount: number;           // in paise (multiply INR by 100)
  currency: string;
  purpose: PaymentPurpose;
  idempotencyKey?: string;
}): Promise<{
  orderId: string;
  amount: number;
  currency: string;
  paymentId: string;
  key: string;
}> {
  const idempotencyKey = params.idempotencyKey ?? `order:${params.bookingId}:${params.purpose}:${uuidv4()}`;

  // Idempotency check — return existing order if already created
  const existing = await queryOne<PaymentRow>(
    `SELECT * FROM payments WHERE idempotency_key = $1`,
    [idempotencyKey],
  );
  if (existing && existing.payment_gateway_order_id) {
    return {
      orderId: existing.payment_gateway_order_id,
      amount: Math.round(parseFloat(existing.exact_financial_amount) * 100),
      currency: existing.currency_code,
      paymentId: existing.id,
      key: env.RAZORPAY_KEY_ID,
    };
  }

  // Create Razorpay order
  let order: Awaited<ReturnType<typeof getRazorpay>['orders']['create']>;
  try {
    order = await getRazorpay().orders.create({
      amount: Math.round(params.amount * 100), // paise
      currency: params.currency,
      receipt: idempotencyKey.slice(0, 40),
      notes: {
        booking_id: params.bookingId,
        purpose: params.purpose,
        payer_id: params.payerId,
      },
    });
  } catch (err) {
    throw new PaymentGatewayError(`Failed to create Razorpay order: ${(err as Error).message}`);
  }

  // Persist payment record
  const paymentRow = await queryOne<PaymentRow>(
    `INSERT INTO payments
       (booking_context_id, payer_user_id, exact_financial_amount, currency_code,
        financial_payment_purpose, payment_gateway_order_id, idempotency_key,
        transaction_clearance_status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'PENDING')
     RETURNING *`,
    [
      params.bookingId,
      params.payerId,
      params.amount,
      params.currency,
      params.purpose,
      order.id,
      idempotencyKey,
    ],
  );

  if (!paymentRow) throw new PaymentGatewayError('Failed to persist payment record');

  logger.info('Razorpay order created', {
    orderId: order.id,
    bookingId: params.bookingId,
    amount: params.amount,
    purpose: params.purpose,
  });

  return {
    orderId: order.id,
    amount: Math.round(params.amount * 100),
    currency: params.currency,
    paymentId: paymentRow.id,
    key: env.RAZORPAY_KEY_ID,
  };
}

// ─────────────────────────────────────────────
// Verify Payment (client-side callback)
// ─────────────────────────────────────────────

export async function verifyAndCapturePayment(params: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  bookingId: string;
  payerId: string;
}): Promise<PaymentRow> {
  // 1. Verify HMAC signature
  const payload = `${params.razorpayOrderId}|${params.razorpayPaymentId}`;
  const isValid = verifyHmacSignature(payload, params.razorpaySignature, env.RAZORPAY_KEY_SECRET);

  if (!isValid) {
    logger.warn('Payment signature mismatch', {
      orderId: params.razorpayOrderId,
      paymentId: params.razorpayPaymentId,
    });
    throw new PaymentVerificationError();
  }

  // 2. Update payment record
  const payment = await queryOne<PaymentRow>(
    `UPDATE payments
     SET transaction_clearance_status = 'SUCCESSFUL',
         payment_gateway_external_id  = $1,
         gateway_signature            = $2,
         updated_at                   = NOW()
     WHERE payment_gateway_order_id = $3
       AND transaction_clearance_status = 'PENDING'
     RETURNING *`,
    [params.razorpayPaymentId, params.razorpaySignature, params.razorpayOrderId],
  );

  if (!payment) {
    throw new BadRequestError('Payment record not found or already processed');
  }

  // 3. Confirm booking (moves bed to OCCUPIED, booking to CONFIRMED)
  await confirmBooking(params.bookingId, payment.id);

  // 4. Notify user
  await dispatchPush({
    userId: params.payerId,
    title: '🎉 Booking Confirmed!',
    body: `Your bed has been booked successfully. Token deposit received.`,
    data: { booking_id: params.bookingId, type: 'BOOKING_CONFIRMED' },
  });

  logger.info('Payment verified and booking confirmed', {
    paymentId: payment.id,
    bookingId: params.bookingId,
    razorpayPaymentId: params.razorpayPaymentId,
  });

  return payment;
}

// ─────────────────────────────────────────────
// Webhook Processing (server-to-server)
// Idempotent — safe to process the same event multiple times
// ─────────────────────────────────────────────

export async function processWebhook(
  rawBody: string,
  signature: string,
): Promise<{ processed: boolean; event: string }> {
  // Verify webhook signature
  const isValid = verifyHmacSignature(rawBody, signature, env.RAZORPAY_WEBHOOK_SECRET);
  if (!isValid) {
    throw new PaymentVerificationError('Webhook signature verification failed');
  }

  const event = JSON.parse(rawBody) as {
    event: string;
    payload: {
      payment?: { entity: { id: string; order_id: string; amount: number; status: string; error_code?: string; error_description?: string } };
      refund?: { entity: { id: string; payment_id: string; amount: number } };
    };
  };

  const eventType = event.event;
  logger.info('Razorpay webhook received', { event: eventType });

  switch (eventType) {
    case 'payment.captured': {
      const p = event.payload.payment?.entity;
      if (!p) break;
      // Idempotent: skip if already processed
      const existing = await queryOne<PaymentRow>(
        `SELECT * FROM payments WHERE payment_gateway_external_id = $1`,
        [p.id],
      );
      if (existing?.transaction_clearance_status === PaymentStatus.SUCCESSFUL) {
        logger.info('Webhook: payment already processed', { paymentId: p.id });
        break;
      }
      // Update payment and confirm booking
      const updated = await queryOne<PaymentRow>(
        `UPDATE payments
         SET transaction_clearance_status = 'SUCCESSFUL',
             payment_gateway_external_id = $1,
             gateway_response = $2,
             updated_at = NOW()
         WHERE payment_gateway_order_id = $3
           AND transaction_clearance_status = 'PENDING'
         RETURNING *`,
        [p.id, JSON.stringify(event.payload.payment?.entity), p.order_id],
      );
      if (updated?.booking_context_id) {
        await confirmBooking(updated.booking_context_id, updated.id).catch((e: Error) =>
          logger.error('Webhook: confirmBooking failed', { error: e.message }),
        );
      }
      break;
    }

    case 'payment.failed': {
      const p = event.payload.payment?.entity;
      if (!p) break;
      await query(
        `UPDATE payments
         SET transaction_clearance_status = 'FAILED',
             failure_reason = $1,
             failure_code   = $2,
             gateway_response = $3,
             updated_at = NOW()
         WHERE payment_gateway_order_id = $4`,
        [
          p.error_description ?? 'Payment failed',
          p.error_code ?? null,
          JSON.stringify(event.payload.payment?.entity),
          p.order_id,
        ],
      );
      break;
    }

    case 'refund.processed': {
      const r = event.payload.refund?.entity;
      if (!r) break;
      await query(
        `UPDATE payments
         SET transaction_clearance_status = 'REFUNDED',
             refunded_at       = NOW(),
             refund_gateway_id = $1,
             refund_amount     = $2,
             updated_at        = NOW()
         WHERE payment_gateway_external_id = $3`,
        [r.id, r.amount / 100, r.payment_id],
      );
      break;
    }

    default:
      logger.debug('Unhandled webhook event', { event: eventType });
  }

  return { processed: true, event: eventType };
}

// ─────────────────────────────────────────────
// Initiate Refund
// ─────────────────────────────────────────────

export async function initiateRefund(params: {
  paymentId: string;
  amount?: number;  // partial refund amount in INR, full if omitted
  reason: string;
  requestedBy: string;
}): Promise<void> {
  const payment = await queryOne<PaymentRow>(
    `SELECT * FROM payments WHERE id = $1`,
    [params.paymentId],
  );
  if (!payment) throw new NotFoundError('Payment', params.paymentId);
  if (payment.transaction_clearance_status !== PaymentStatus.SUCCESSFUL) {
    throw new BadRequestError('Only successful payments can be refunded');
  }
  if (!payment.payment_gateway_external_id) {
    throw new BadRequestError('Payment has no gateway reference for refund');
  }

  const refundAmountPaise = params.amount
    ? Math.round(params.amount * 100)
    : Math.round(parseFloat(payment.exact_financial_amount) * 100);

  try {
    await getRazorpay().payments.refund(payment.payment_gateway_external_id, {
      amount: refundAmountPaise,
      notes: { reason: params.reason, requested_by: params.requestedBy },
    });
  } catch (err) {
    throw new PaymentGatewayError(`Refund failed: ${(err as Error).message}`);
  }

  logger.info('Refund initiated', {
    paymentId: params.paymentId,
    amount: params.amount,
    reason: params.reason,
  });
}

// ─────────────────────────────────────────────
// Get payments for a booking
// ─────────────────────────────────────────────

export async function getBookingPayments(bookingId: string): Promise<PaymentRow[]> {
  return query<PaymentRow>(
    `SELECT id, booking_context_id, exact_financial_amount, currency_code,
            transaction_clearance_status, financial_payment_purpose,
            payment_gateway_order_id, payment_gateway_external_id,
            transaction_timestamp, updated_at
     FROM payments WHERE booking_context_id = $1
     ORDER BY transaction_timestamp DESC`,
    [bookingId],
  ).then((r) => r.rows);
}

export async function getTenantPaymentHistory(
  tenantId: string,
  page: number,
  limit: number,
): Promise<{ rows: PaymentRow[]; total: number }> {
  const offset = (page - 1) * limit;
  const [rows, countRow] = await Promise.all([
    query<PaymentRow>(
      `SELECT p.id, p.booking_context_id, p.exact_financial_amount, p.currency_code,
              p.transaction_clearance_status, p.financial_payment_purpose,
              p.payment_gateway_order_id, p.transaction_timestamp,
              prop.property_display_name, r.room_identifier_code
       FROM payments p
       LEFT JOIN bookings bk ON bk.id = p.booking_context_id
       LEFT JOIN beds b ON b.id = bk.assigned_bed_id
       LEFT JOIN rooms r ON r.id = b.room_parent_id
       LEFT JOIN properties prop ON prop.id = r.property_parent_id
       WHERE p.payer_user_id = $1
       ORDER BY p.transaction_timestamp DESC
       LIMIT $2 OFFSET $3`,
      [tenantId, limit, offset],
    ).then((r) => r.rows),
    queryOne<{ count: string }>(
      `SELECT COUNT(*) FROM payments WHERE payer_user_id = $1`,
      [tenantId],
    ),
  ]);
  return { rows, total: parseInt(countRow?.count ?? '0', 10) };
}
