import { Queue, QueueOptions } from 'bullmq';
import { getQueueClient } from '@config/redis';
import { logger } from '@shared/utils/logger';
import {
  SendSmsJobData,
  SendEmailJobData,
  SendPushJobData,
  ReleaseReservationJobData,
  ProcessRentInvoiceJobData,
} from '@shared/types';

// ─────────────────────────────────────────────
// Queue Names
// ─────────────────────────────────────────────

export const QUEUE_NAMES = {
  SMS: 'sms',
  EMAIL: 'email',
  PUSH_NOTIFICATION: 'push-notification',
  RELEASE_RESERVATION: 'release-reservation',
  RENT_INVOICE: 'rent-invoice',
  KYC_VERIFICATION: 'kyc-verification',
  NOTIFICATION: 'notification',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// ─────────────────────────────────────────────
// Job Names
// ─────────────────────────────────────────────

export const JOB_NAMES = {
  SEND_OTP_SMS: 'send-otp-sms',
  SEND_BOOKING_SMS: 'send-booking-sms',
  SEND_PAYMENT_SMS: 'send-payment-sms',
  SEND_WELCOME_EMAIL: 'send-welcome-email',
  SEND_BOOKING_EMAIL: 'send-booking-email',
  SEND_INVOICE_EMAIL: 'send-invoice-email',
  SEND_PUSH: 'send-push',
  RELEASE_BED_LOCK: 'release-bed-lock',
  GENERATE_RENT_INVOICE: 'generate-rent-invoice',
  PROCESS_KYC: 'process-kyc',
} as const;

// ─────────────────────────────────────────────
// Shared Queue Options
// ─────────────────────────────────────────────

function buildQueueOptions(): QueueOptions {
  return {
    connection: getQueueClient(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: { count: 100, age: 24 * 60 * 60 },  // keep 100 jobs, max 24h
      removeOnFail: { count: 500, age: 7 * 24 * 60 * 60 },  // keep 500 failed, max 7d
    },
  };
}

// ─────────────────────────────────────────────
// Queue Instances (lazy singletons)
// ─────────────────────────────────────────────

let smsQueue: Queue<SendSmsJobData> | null = null;
let emailQueue: Queue<SendEmailJobData> | null = null;
let pushQueue: Queue<SendPushJobData> | null = null;
let reservationReleaseQueue: Queue<ReleaseReservationJobData> | null = null;
let rentInvoiceQueue: Queue<ProcessRentInvoiceJobData> | null = null;

export function getSmsQueue(): Queue<SendSmsJobData> {
  if (!smsQueue) smsQueue = new Queue(QUEUE_NAMES.SMS, buildQueueOptions());
  return smsQueue;
}

export function getEmailQueue(): Queue<SendEmailJobData> {
  if (!emailQueue) emailQueue = new Queue(QUEUE_NAMES.EMAIL, buildQueueOptions());
  return emailQueue;
}

export function getPushQueue(): Queue<SendPushJobData> {
  if (!pushQueue) pushQueue = new Queue(QUEUE_NAMES.PUSH_NOTIFICATION, buildQueueOptions());
  return pushQueue;
}

export function getReservationReleaseQueue(): Queue<ReleaseReservationJobData> {
  if (!reservationReleaseQueue) {
    reservationReleaseQueue = new Queue(QUEUE_NAMES.RELEASE_RESERVATION, {
      ...buildQueueOptions(),
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 200 },
      },
    });
  }
  return reservationReleaseQueue;
}

export function getRentInvoiceQueue(): Queue<ProcessRentInvoiceJobData> {
  if (!rentInvoiceQueue) rentInvoiceQueue = new Queue(QUEUE_NAMES.RENT_INVOICE, buildQueueOptions());
  return rentInvoiceQueue;
}

// ─────────────────────────────────────────────
// Job Dispatchers
// ─────────────────────────────────────────────

export async function dispatchSms(data: SendSmsJobData, jobName = JOB_NAMES.SEND_OTP_SMS): Promise<void> {
  await getSmsQueue().add(jobName, data, { priority: jobName === JOB_NAMES.SEND_OTP_SMS ? 1 : 5 });
}

export async function dispatchEmail(data: SendEmailJobData, jobName = JOB_NAMES.SEND_BOOKING_EMAIL): Promise<void> {
  await getEmailQueue().add(jobName, data);
}

export async function dispatchPush(data: SendPushJobData): Promise<void> {
  await getPushQueue().add(JOB_NAMES.SEND_PUSH, data);
}

export async function scheduleReservationRelease(
  data: ReleaseReservationJobData,
  delayMs: number,
): Promise<void> {
  await getReservationReleaseQueue().add(JOB_NAMES.RELEASE_BED_LOCK, data, {
    delay: delayMs,
    jobId: `release:booking:${data.bookingId}`, // deduplicate by booking
  });
  logger.debug('Reservation release job scheduled', {
    bookingId: data.bookingId,
    delayMs,
  });
}

export async function cancelReservationRelease(bookingId: string): Promise<void> {
  const job = await getReservationReleaseQueue().getJob(
    `release:booking:${bookingId}`,
  );
  if (job) {
    await job.remove();
    logger.debug('Reservation release job cancelled', { bookingId });
  }
}

export async function dispatchRentInvoice(data: ProcessRentInvoiceJobData): Promise<void> {
  await getRentInvoiceQueue().add(JOB_NAMES.GENERATE_RENT_INVOICE, data, {
    jobId: `rent:${data.bookingId}:${data.year}:${data.month}`, // idempotent
  });
}

// ─────────────────────────────────────────────
// Close all queues gracefully
// ─────────────────────────────────────────────

export async function closeAllQueues(): Promise<void> {
  const queues = [smsQueue, emailQueue, pushQueue, reservationReleaseQueue, rentInvoiceQueue];
  await Promise.all(queues.filter(Boolean).map((q) => q!.close()));
  logger.info('All BullMQ queues closed');
}
