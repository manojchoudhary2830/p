import { z } from 'zod';

const phoneRegex = /^\+?[1-9]\d{9,14}$/;

export const SendOtpSchema = z.object({
  phone_number: z
    .string()
    .trim()
    .regex(phoneRegex, 'Enter a valid phone number (e.g. +919876543210)'),
});

export const VerifyOtpSchema = z.object({
  phone_number: z
    .string()
    .trim()
    .regex(phoneRegex, 'Enter a valid phone number'),
  otp: z
    .string()
    .trim()
    .length(6, 'OTP must be exactly 6 digits')
    .regex(/^\d+$/, 'OTP must contain only digits'),
  device_id: z.string().max(255).optional(),
  device_info: z
    .object({
      platform: z.enum(['ios', 'android', 'web']).optional(),
      app_version: z.string().max(20).optional(),
      model: z.string().max(100).optional(),
    })
    .optional(),
});

export const RefreshTokenSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token is required'),
});

export const RegisterProfileSchema = z.object({
  legal_full_name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(120, 'Name must be under 120 characters')
    .regex(/^[a-zA-Z\s.'-]+$/, 'Name contains invalid characters'),
  email_address: z.string().email('Invalid email address').toLowerCase().optional(),
  account_role: z.enum(['TENANT', 'OWNER']).default('TENANT'),
});

export type SendOtpDto = z.infer<typeof SendOtpSchema>;
export type VerifyOtpDto = z.infer<typeof VerifyOtpSchema>;
export type RefreshTokenDto = z.infer<typeof RefreshTokenSchema>;
export type RegisterProfileDto = z.infer<typeof RegisterProfileSchema>;
