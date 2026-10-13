import { Request, Response } from 'express';
import * as authService from '../services/auth.service';
import * as authRepo from '../repositories/auth.repository';
import { sendSuccess, sendCreated } from '@shared/utils/response';
import { normalizePhoneNumber } from '@shared/utils/crypto';
import { RegisterProfileDto, RegisterProfileSchema } from '../validators/auth.validator';
import { validateBody } from '@shared/middleware/validation.middleware';
import { NotFoundError } from '@shared/errors';

// ─────────────────────────────────────────────
// POST /auth/otp/send
// ─────────────────────────────────────────────

export async function sendOtp(req: Request, res: Response): Promise<void> {
  const { phone_number } = req.body as { phone_number: string };
  const result = await authService.sendOtp({
    phoneNumber: phone_number,
    ipAddress: req.ip,
  });
  sendSuccess(res, null, result.message, 202, {
    resend_after_seconds: result.resendAfterSeconds,
  });
}

// ─────────────────────────────────────────────
// POST /auth/otp/verify
// ─────────────────────────────────────────────

export async function verifyOtp(req: Request, res: Response): Promise<void> {
  const { phone_number, otp, device_id, device_info } = req.body as {
    phone_number: string;
    otp: string;
    device_id?: string;
    device_info?: Record<string, unknown>;
  };

  const result = await authService.verifyOtp({
    phoneNumber: phone_number,
    otp,
    deviceId: device_id,
    deviceInfo: device_info,
    ipAddress: req.ip,
  });

  const statusCode = result.isNewUser ? 201 : 200;
  sendSuccess(
    res,
    {
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
      token_type: 'Bearer',
      access_token_expires_at: result.accessTokenExpiresAt,
      refresh_token_expires_at: result.refreshTokenExpiresAt,
      user: {
        id: result.user.id,
        phone_number: result.user.phone_number,
        legal_full_name: result.user.legal_full_name,
        email_address: result.user.email_address,
        account_role: result.user.account_role,
        identity_kyc_status: result.user.identity_kyc_status,
        is_active: result.user.is_active,
      },
      is_new_user: result.isNewUser,
    },
    result.isNewUser ? 'Account created. Please complete your profile.' : 'Login successful.',
    statusCode,
  );
}

// ─────────────────────────────────────────────
// POST /auth/token/refresh
// ─────────────────────────────────────────────

export async function refreshToken(req: Request, res: Response): Promise<void> {
  const { refresh_token } = req.body as { refresh_token: string };
  const tokens = await authService.refreshAccessToken(refresh_token);

  sendSuccess(res, {
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    token_type: 'Bearer',
    access_token_expires_at: tokens.accessTokenExpiresAt,
    refresh_token_expires_at: tokens.refreshTokenExpiresAt,
  });
}

// ─────────────────────────────────────────────
// POST /auth/logout
// ─────────────────────────────────────────────

export async function logout(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const accessToken = req.headers.authorization?.replace('Bearer ', '');
  await authService.logout(userId, accessToken);
  sendSuccess(res, null, 'Logged out successfully');
}

// ─────────────────────────────────────────────
// PATCH /auth/profile
// Complete profile after first login
// ─────────────────────────────────────────────

export async function completeProfile(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const body = req.body as RegisterProfileDto;

  const user = await authRepo.updateUserProfile(userId, {
    legalFullName: body.legal_full_name,
    emailAddress: body.email_address,
  });

  sendSuccess(res, {
    id: user.id,
    phone_number: user.phone_number,
    legal_full_name: user.legal_full_name,
    email_address: user.email_address,
    account_role: user.account_role,
    identity_kyc_status: user.identity_kyc_status,
  }, 'Profile updated successfully');
}

// ─────────────────────────────────────────────
// GET /auth/me
// ─────────────────────────────────────────────

export async function getMe(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const user = await authRepo.findUserById(userId);

  if (!user) throw new NotFoundError('User');

  sendSuccess(res, {
    id: user.id,
    phone_number: user.phone_number,
    legal_full_name: user.legal_full_name,
    email_address: user.email_address,
    account_role: user.account_role,
    identity_kyc_status: user.identity_kyc_status,
    is_active: user.is_active,
    last_login_at: user.last_login_at,
    record_created_at: user.record_created_at,
  });
}
