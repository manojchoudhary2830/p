import { makePayment, makeBooking, testIds } from '../fixtures/setup';

jest.mock('@config/database');
jest.mock('@config/redis');
jest.mock('@infrastructure/queue/bullmq.client');

describe('Payment Service', () => {
  const mockQuery = { queryOne: jest.fn(), query: jest.fn(), queryMany: jest.fn() };

  jest.mock('@config/database', () => mockQuery);
  jest.mock('@domains/bookings/services/booking.service', () => ({
    confirmBooking: jest.fn(),
  }));

  const FAKE_SECRET = 'test_razorpay_secret_32chars_long_xx';

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.RAZORPAY_KEY_SECRET = FAKE_SECRET;
    process.env.RAZORPAY_WEBHOOK_SECRET = FAKE_SECRET;
  });

  // ─── Signature Verification ───────────────

  describe('Razorpay Signature Verification', () => {
    it('verifies a valid HMAC-SHA256 payment signature', async () => {
      const crypto = await import('crypto');
      const { verifyHmacSignature } = await import('@shared/utils/crypto');

      const orderId = 'order_test123';
      const paymentId = 'pay_test456';
      const payload = `${orderId}|${paymentId}`;
      const validSig = crypto
        .createHmac('sha256', FAKE_SECRET)
        .update(payload)
        .digest('hex');

      expect(verifyHmacSignature(payload, validSig, FAKE_SECRET)).toBe(true);
    });

    it('rejects a tampered signature', async () => {
      const { verifyHmacSignature } = await import('@shared/utils/crypto');
      expect(
        verifyHmacSignature('order_abc|pay_xyz', 'invalid_sig_here', FAKE_SECRET),
      ).toBe(false);
    });

    it('verifyAndCapturePayment throws PaymentVerificationError on bad signature', async () => {
      const { verifyAndCapturePayment } = await import('@domains/payments/services/payment.service');
      const { PaymentVerificationError } = await import('@shared/errors');

      await expect(
        verifyAndCapturePayment({
          razorpayOrderId: 'order_test',
          razorpayPaymentId: 'pay_test',
          razorpaySignature: 'bad_signature',
          bookingId: testIds.booking,
          payerId: testIds.tenant,
        }),
      ).rejects.toThrow(PaymentVerificationError);
    });
  });

  // ─── Webhook Processing ───────────────────

  describe('processWebhook', () => {
    const crypto = require('crypto');

    function makeWebhookPayload(event: string, paymentEntity: object) {
      const body = JSON.stringify({ event, payload: { payment: { entity: paymentEntity } } });
      const sig = crypto.createHmac('sha256', FAKE_SECRET).update(body).digest('hex');
      return { body, sig };
    }

    it('rejects webhook with invalid signature', async () => {
      const { processWebhook } = await import('@domains/payments/services/payment.service');
      const { PaymentVerificationError } = await import('@shared/errors');

      await expect(
        processWebhook('{"event":"payment.captured"}', 'bad_signature'),
      ).rejects.toThrow(PaymentVerificationError);
    });

    it('processes payment.captured and confirms booking', async () => {
      const { processWebhook } = await import('@domains/payments/services/payment.service');
      const { confirmBooking } = await import('@domains/bookings/services/booking.service');

      const entity = {
        id: 'pay_captured',
        order_id: 'order_captured',
        amount: 250000,
        status: 'captured',
      };
      const { body, sig } = makeWebhookPayload('payment.captured', entity);

      // Mock: payment not yet processed
      mockQuery.queryOne.mockResolvedValueOnce(null);
      // Mock: update payment
      mockQuery.queryOne.mockResolvedValueOnce({
        ...makePayment(),
        booking_context_id: testIds.booking,
        id: testIds.payment,
      });

      const result = await processWebhook(body, sig);

      expect(result.processed).toBe(true);
      expect(result.event).toBe('payment.captured');
      expect(confirmBooking).toHaveBeenCalledWith(testIds.booking, testIds.payment);
    });

    it('is idempotent — skips already-processed payments', async () => {
      const { processWebhook } = await import('@domains/payments/services/payment.service');
      const { confirmBooking } = await import('@domains/bookings/services/booking.service');

      const entity = { id: 'pay_dup', order_id: 'order_dup', amount: 250000, status: 'captured' };
      const { body, sig } = makeWebhookPayload('payment.captured', entity);

      // Payment already SUCCESSFUL in DB
      mockQuery.queryOne.mockResolvedValueOnce(
        makePayment({ transaction_clearance_status: 'SUCCESSFUL' }),
      );

      await processWebhook(body, sig);

      // confirmBooking should NOT be called again
      expect(confirmBooking).not.toHaveBeenCalled();
    });

    it('marks payment as FAILED on payment.failed event', async () => {
      const { processWebhook } = await import('@domains/payments/services/payment.service');

      const entity = {
        id: 'pay_failed', order_id: 'order_failed',
        error_code: 'BAD_REQUEST_ERROR',
        error_description: 'Insufficient funds',
      };
      const { body, sig } = makeWebhookPayload('payment.failed', entity);

      mockQuery.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const result = await processWebhook(body, sig);
      expect(result.event).toBe('payment.failed');
      expect(mockQuery.query).toHaveBeenCalledWith(
        expect.stringContaining('FAILED'),
        expect.arrayContaining(['Insufficient funds']),
      );
    });

    it('returns processed:true for unknown events without throwing', async () => {
      const { processWebhook } = await import('@domains/payments/services/payment.service');

      const body = JSON.stringify({ event: 'subscription.charged', payload: {} });
      const sig = crypto.createHmac('sha256', FAKE_SECRET).update(body).digest('hex');

      const result = await processWebhook(body, sig);
      expect(result.processed).toBe(true);
    });
  });

  // ─── createPaymentOrder ───────────────────

  describe('createPaymentOrder', () => {
    it('returns existing order on duplicate idempotency key', async () => {
      const { createPaymentOrder } = await import('@domains/payments/services/payment.service');
      const existingPayment = makePayment({ payment_gateway_order_id: 'order_existing' });

      mockQuery.queryOne.mockResolvedValueOnce(existingPayment);

      const result = await createPaymentOrder({
        bookingId: testIds.booking,
        payerId: testIds.tenant,
        amount: 2500,
        currency: 'INR',
        purpose: 'TOKEN_DEPOSIT' as const,
        idempotencyKey: 'existing-key',
      });

      expect(result.orderId).toBe('order_existing');
    });
  });
});
