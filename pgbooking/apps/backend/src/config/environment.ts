import { z } from 'zod';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({
  path: path.resolve(process.cwd(), `.env.${process.env.NODE_ENV ?? 'development'}`),
});

const EnvironmentSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_NAME: z.string().default('PG Booking API'),
  APP_VERSION: z.string().default('1.0.0'),
  API_PREFIX: z.string().default('/api/v1'),
  CORS_ORIGINS: z.string().transform((s: string) => s.split(',').map((o) => o.trim())),

  // Database
  DATABASE_URL: z.string().url(),
  DB_POOL_MIN: z.coerce.number().int().positive().default(2),
  DB_POOL_MAX: z.coerce.number().int().positive().default(20),
  DB_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  DB_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  DB_SSL: z.coerce.boolean().default(false),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_CACHE_DB: z.coerce.number().int().min(0).max(15).default(0),
  REDIS_SESSION_DB: z.coerce.number().int().min(0).max(15).default(1),
  REDIS_LOCK_DB: z.coerce.number().int().min(0).max(15).default(2),
  REDIS_QUEUE_DB: z.coerce.number().int().min(0).max(15).default(3),
  REDIS_KEY_PREFIX: z.string().default('pgbooking:'),

  // JWT
  JWT_PRIVATE_KEY_PATH: z.string(),
  JWT_PUBLIC_KEY_PATH: z.string(),
  JWT_ACCESS_TOKEN_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_TOKEN_EXPIRY: z.string().default('7d'),
  JWT_ISSUER: z.string().default('pgbooking-api'),
  JWT_AUDIENCE: z.string().default('pgbooking-client'),

  // OTP
  OTP_LENGTH: z.coerce.number().int().min(4).max(8).default(6),
  OTP_EXPIRY_SECONDS: z.coerce.number().int().positive().default(300),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(3),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(60),
  OTP_LOCKOUT_DURATION_SECONDS: z.coerce.number().int().positive().default(900),

  // AWS
  AWS_REGION: z.string().default('ap-south-1'),
  AWS_ACCESS_KEY_ID: z.string(),
  AWS_SECRET_ACCESS_KEY: z.string(),
  AWS_S3_BUCKET_KYC: z.string(),
  AWS_S3_BUCKET_PROPERTIES: z.string(),
  AWS_S3_BUCKET_MAINTENANCE: z.string(),
  AWS_S3_SIGNED_URL_EXPIRY_SECONDS: z.coerce.number().int().positive().default(3600),
  AWS_ENDPOINT_URL: z.string().url().optional(),

  // Razorpay
  RAZORPAY_KEY_ID: z.string(),
  RAZORPAY_KEY_SECRET: z.string(),
  RAZORPAY_WEBHOOK_SECRET: z.string(),

  // Twilio
  TWILIO_ACCOUNT_SID: z.string(),
  TWILIO_AUTH_TOKEN: z.string(),
  TWILIO_PHONE_NUMBER: z.string(),
  TWILIO_MESSAGING_SERVICE_SID: z.string().optional(),

  // Firebase
  FIREBASE_PROJECT_ID: z.string(),
  FIREBASE_PRIVATE_KEY_ID: z.string(),
  FIREBASE_PRIVATE_KEY: z.string().transform((s: string) => s.replace(/\\n/g, '\n')),
  FIREBASE_CLIENT_EMAIL: z.string().email(),
  FIREBASE_CLIENT_ID: z.string(),

  // Email
  SMTP_HOST: z.string(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: z.string(),
  SMTP_PASSWORD: z.string(),
  EMAIL_FROM: z.string().email(),
  EMAIL_FROM_NAME: z.string().default('PG Booking'),

  // Rate Limiting
  RATE_LIMIT_GLOBAL_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_GLOBAL_MAX: z.coerce.number().int().positive().default(500),
  RATE_LIMIT_AUTH_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_OTP_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_OTP_MAX: z.coerce.number().int().positive().default(3),

  // Booking Engine
  BOOKING_LOCK_TTL_MS: z.coerce.number().int().positive().default(600000),
  BOOKING_LOCK_RETRY_COUNT: z.coerce.number().int().positive().default(3),
  BOOKING_LOCK_RETRY_DELAY_MS: z.coerce.number().int().positive().default(100),

  // Upload
  UPLOAD_MAX_FILE_SIZE_MB: z.coerce.number().int().positive().default(5),
  UPLOAD_ALLOWED_MIME_TYPES: z
    .string()
    .transform((s: string) => s.split(',').map((t) => t.trim()))
    .default('image/jpeg,image/png,image/webp,application/pdf'),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('debug'),
  LOG_DIR: z.string().default('./logs'),
  LOG_MAX_FILES: z.string().default('14d'),
  LOG_MAX_SIZE: z.string().default('20m'),

  // Cron
  RENT_INVOICE_CRON: z.string().default('0 9 1 * *'),
  RESERVATION_CLEANUP_CRON: z.string().default('*/10 * * * *'),
  NOTIFICATION_REMINDER_CRON: z.string().default('0 10 * * *'),

  // Encryption
  ENCRYPTION_KEY: z.string().min(32),
  ENCRYPTION_IV_LENGTH: z.coerce.number().int().positive().default(12),

  // Socket.IO
  SOCKET_CORS_ORIGINS: z
    .string()
    .transform((s: string) => s.split(',').map((o) => o.trim()))
    .default('http://localhost:3000'),
  SOCKET_PING_TIMEOUT: z.coerce.number().int().positive().default(60000),
  SOCKET_PING_INTERVAL: z.coerce.number().int().positive().default(25000),
});

function validateEnvironment() {
  const result = EnvironmentSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const errorMessages = (Object.entries(errors) as [string, string[]][]).map(([field, messages]) => `  ${field}: ${messages?.join(', ')}`)
      .join('\n');

    console.error('❌ Invalid environment configuration:\n' + errorMessages);
    process.exit(1);
  }

  return result.data;
}

export const env = validateEnvironment();
export type Environment = z.infer<typeof EnvironmentSchema>;
