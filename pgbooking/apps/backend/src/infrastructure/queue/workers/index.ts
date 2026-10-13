import { Worker, Job } from 'bullmq';
import { getQueueClient } from '@config/redis';
import { logger } from '@shared/utils/logger';
import { QUEUE_NAMES, JOB_NAMES } from './bullmq.client';
import {
  SendSmsJobData,
  SendEmailJobData,
  SendPushJobData,
  ReleaseReservationJobData,
  ProcessRentInvoiceJobData,
} from '@shared/types';

// ─────────────────────────────────────────────
// Worker factory helper
// ─────────────────────────────────────────────

function buildWorkerOptions() {
  return {
    connection: getQueueClient(),
    concurrency: 10,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  };
}

// ─────────────────────────────────────────────
// SMS Worker
// ─────────────────────────────────────────────

function createSmsWorker(): Worker<SendSmsJobData> {
  const worker = new Worker<SendSmsJobData>(
    QUEUE_NAMES.SMS,
    async (job: Job<SendSmsJobData>) => {
      const { to, message } = job.data;
      const { sendSms } = await import('@infrastructure/sms/twilio.client');
      await sendSms(to, message);
      logger.info('SMS job completed', { jobId: job.id, to: to.slice(-4) });
    },
    {
      ...buildWorkerOptions(),
      concurrency: 5, // SMS has lower concurrency
    },
  );

  worker.on('failed', (job: any, err: any) => {
    logger.error('SMS job failed', { jobId: job?.id, error: err.message });
  });

  return worker;
}

// ─────────────────────────────────────────────
// Email Worker
// ─────────────────────────────────────────────

function createEmailWorker(): Worker<SendEmailJobData> {
  const worker = new Worker<SendEmailJobData>(
    QUEUE_NAMES.EMAIL,
    async (job: Job<SendEmailJobData>) => {
      const { to, subject, templateName, variables } = job.data;
      const { sendEmail } = await import('@infrastructure/email/nodemailer.client');
      await sendEmail({ to, subject, templateName, variables });
      logger.info('Email job completed', { jobId: job.id, to });
    },
    buildWorkerOptions(),
  );

  worker.on('failed', (job: any, err: any) => {
    logger.error('Email job failed', { jobId: job?.id, error: err.message });
  });

  return worker;
}

// ─────────────────────────────────────────────
// Push Notification Worker
// ─────────────────────────────────────────────

function createPushWorker(): Worker<SendPushJobData> {
  const worker = new Worker<SendPushJobData>(
    QUEUE_NAMES.PUSH_NOTIFICATION,
    async (job: Job<SendPushJobData>) => {
      const { userId, title, body, data } = job.data;
      const { sendPushToUser } = await import('@infrastructure/push/firebase.client');
      await sendPushToUser(userId, { title, body, data });
      logger.info('Push job completed', { jobId: job.id, userId });
    },
    buildWorkerOptions(),
  );

  worker.on('failed', (job: any, err: any) => {
    logger.error('Push job failed', { jobId: job?.id, error: err.message });
  });

  return worker;
}

// ─────────────────────────────────────────────
// Reservation Release Worker
// Runs when the 10-minute booking lock expires
// ─────────────────────────────────────────────

function createReservationReleaseWorker(): Worker<ReleaseReservationJobData> {
  const worker = new Worker<ReleaseReservationJobData>(
    QUEUE_NAMES.RELEASE_RESERVATION,
    async (job: Job<ReleaseReservationJobData>) => {
      const { bookingId, bedId, lockKey } = job.data;
      logger.info('Processing reservation release', { bookingId, bedId });

      const { query } = await import('@config/database');
      const { getLockClient } = await import('@config/redis');

      // Release DB: run stored procedure
      const result = await query<{ release_expired_reservation: boolean }>(
        'SELECT release_expired_reservation($1)',
        [bookingId],
      );

      const released = result.rows[0]?.release_expired_reservation ?? false;

      if (released) {
        // Clean up Redis lock if it still exists
        await getLockClient().del(lockKey);
        logger.info('Reservation released successfully', { bookingId, bedId });

        // Notify tenant via Socket.IO
        const { getSocketIO } = await import('@infrastructure/socket/socket.server');
        const io = getSocketIO();
        if (io) {
          io.to(`booking:${bookingId}`).emit('reservation:expired', {
            bookingId,
            message: 'Your reservation has expired. Please start again.',
          });
        }
      } else {
        logger.info('Reservation already confirmed or cancelled', { bookingId });
      }
    },
    {
      ...buildWorkerOptions(),
      concurrency: 20, // Release jobs should process quickly
    },
  );

  worker.on('failed', (job: any, err: any) => {
    logger.error('Reservation release job failed', { jobId: job?.id, error: err.message });
  });

  return worker;
}

// ─────────────────────────────────────────────
// Rent Invoice Worker
// ─────────────────────────────────────────────

function createRentInvoiceWorker(): Worker<ProcessRentInvoiceJobData> {
  const worker = new Worker<ProcessRentInvoiceJobData>(
    QUEUE_NAMES.RENT_INVOICE,
    async (job: Job<ProcessRentInvoiceJobData>) => {
      const { bookingId, month, year } = job.data;
      logger.info('Generating rent invoice', { bookingId, month, year });

      const { query } = await import('@config/database');
      // Create payment record for monthly rent
      await query(
        `INSERT INTO payments
          (booking_context_id, payer_user_id, exact_financial_amount, financial_payment_purpose,
           transaction_clearance_status, idempotency_key, currency_code)
         SELECT
           bk.id,
           bk.tenant_user_id,
           bk.monthly_rent_amount,
           'MONTHLY_RENT',
           'PENDING',
           'rent:' || bk.id || ':' || $2 || ':' || $3,
           'INR'
         FROM bookings bk
         WHERE bk.id = $1
           AND bk.current_booking_lifecycle_state = 'CONFIRMED'
           AND bk.deleted_at IS NULL
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [bookingId, year, month],
      );

      logger.info('Rent invoice created', { bookingId, month, year });
    },
    buildWorkerOptions(),
  );

  worker.on('failed', (job: any, err: any) => {
    logger.error('Rent invoice job failed', { jobId: job?.id, error: err.message });
  });

  return worker;
}

// ─────────────────────────────────────────────
// Start All Workers
// ─────────────────────────────────────────────

let workers: Worker[] = [];

export async function startWorkers(): Promise<void> {
  workers = [
    createSmsWorker(),
    createEmailWorker(),
    createPushWorker(),
    createReservationReleaseWorker(),
    createRentInvoiceWorker(),
  ];

  logger.info(`✅ ${workers.length} BullMQ workers started`);
}

export async function stopWorkers(): Promise<void> {
  await Promise.all(workers.map((w) => w.close()));
  workers = [];
  logger.info('All BullMQ workers stopped');
}
