import nodemailer, { Transporter } from 'nodemailer';
import { env } from '@config/environment';
import { logger } from '@shared/utils/logger';
import { ExternalServiceError } from '@shared/errors';

// ─────────────────────────────────────────────
// Transport
// ─────────────────────────────────────────────

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
    });
  }
  return transporter;
}

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  templateName?: string;
  variables?: Record<string, unknown>;
  replyTo?: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType: string }>;
}

// Resolve html from templateName+variables if html not provided directly
function resolveHtml(options: EmailOptions): string {
  if (options.html) return options.html;
  if (options.templateName) {
    // Inline template renderer — expand as needed
    const vars = options.variables ?? {};
    const templates: Record<string, (v: Record<string, unknown>) => string> = {
      'welcome':             (v) => `<h2>Welcome, ${v.name}!</h2><p>Your PG Booking account is ready.</p>`,
      'booking_confirmed':   (v) => `<h2>Booking Confirmed!</h2><p>Property: ${v.propertyName}</p><p>Check-in: ${v.checkIn}</p>`,
      'rent_invoice':        (v) => `<h2>Rent Invoice</h2><p>Amount: ₹${v.amount}</p><p>Due: ${v.dueDate}</p>`,
      'booking_cancelled':   (v) => `<h2>Booking Cancelled</h2><p>Your booking has been cancelled. Reason: ${v.reason}</p>`,
      'kyc_approved':        (_v) => `<h2>KYC Approved</h2><p>Your identity verification is complete. You can now book beds.</p>`,
      'kyc_rejected':        (v) => `<h2>KYC Rejected</h2><p>Reason: ${v.reason}</p><p>Please re-upload your documents.</p>`,
      'otp':                 (v) => `<h2>Your OTP</h2><p>Your OTP is: <strong>${v.otp}</strong></p><p>Valid for 5 minutes.</p>`,
    };
    const fn = templates[options.templateName];
    if (fn) return fn(vars);
    return `<p>${JSON.stringify(vars)}</p>`;
  }
  return '<p></p>';
}

// ─────────────────────────────────────────────
// Core sender
// ─────────────────────────────────────────────

export async function sendEmail(options: EmailOptions): Promise<void> {
  const t = getTransporter();
  try {
    const info = await t.sendMail({
      from: `"PG Booking" <${env.EMAIL_FROM}>`,
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      subject: options.subject,
      html: resolveHtml(options),
      text: options.text ?? resolveHtml(options).replace(/<[^>]+>/g, ''),
      replyTo: options.replyTo,
      attachments: options.attachments,
    });
    logger.info('Email sent', { messageId: info.messageId, to: options.to, subject: options.subject });
  } catch (error) {
    logger.error('Email send failed', { to: options.to, subject: options.subject, error: (error as Error).message });
    throw new ExternalServiceError('Nodemailer', (error as Error).message);
  }
}

// ─────────────────────────────────────────────
// Specific email templates
// ─────────────────────────────────────────────

export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  await sendEmail({
    to,
    subject: 'Welcome to PG Booking!',
    html: `
      <h2>Hi ${name},</h2>
      <p>Welcome to PG Booking — your trusted platform to find and book paying guest accommodations.</p>
      <p>Complete your KYC verification to unlock all booking features.</p>
      <br><p>The PG Booking Team</p>`,
  });
}

export async function sendBookingConfirmationEmail(
  to: string,
  data: { name: string; propertyName: string; roomCode: string; bedCode: string; checkIn: string; rent: number },
): Promise<void> {
  await sendEmail({
    to,
    subject: `Booking Confirmed — ${data.propertyName}`,
    html: `
      <h2>Booking Confirmed!</h2>
      <p>Hi ${data.name},</p>
      <p>Your bed reservation has been confirmed:</p>
      <ul>
        <li><strong>Property:</strong> ${data.propertyName}</li>
        <li><strong>Room:</strong> ${data.roomCode}</li>
        <li><strong>Bed:</strong> ${data.bedCode}</li>
        <li><strong>Check-in:</strong> ${data.checkIn}</li>
        <li><strong>Monthly Rent:</strong> ₹${data.rent.toLocaleString('en-IN')}</li>
      </ul>
      <p>See you soon!</p>`,
  });
}

export async function sendRentInvoiceEmail(
  to: string,
  data: { name: string; month: string; amount: number; dueDate: string },
): Promise<void> {
  await sendEmail({
    to,
    subject: `Rent Invoice — ${data.month}`,
    html: `
      <h2>Rent Invoice</h2>
      <p>Hi ${data.name},</p>
      <p>Your rent invoice for <strong>${data.month}</strong>:</p>
      <p style="font-size:24px;font-weight:bold">₹${data.amount.toLocaleString('en-IN')}</p>
      <p><strong>Due Date:</strong> ${data.dueDate}</p>
      <p>Please pay on time to avoid late charges.</p>`,
  });
}

export async function verifySmtpConnection(): Promise<boolean> {
  try {
    await getTransporter().verify();
    logger.info('SMTP connection verified');
    return true;
  } catch (error) {
    logger.warn('SMTP connection failed — emails will not be sent', { error: (error as Error).message });
    return false;
  }
}
