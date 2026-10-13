import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { validateBody } from '@shared/middleware/validation.middleware';
import { authenticate } from '@shared/middleware/auth.middleware';
import { auditLog } from '@shared/middleware/audit.middleware';
import { authRateLimit, otpRateLimit } from '@shared/middleware/rate-limit.middleware';
import {
  SendOtpSchema,
  VerifyOtpSchema,
  RefreshTokenSchema,
  RegisterProfileSchema,
} from '../validators/auth.validator';

export const authRouter = Router();

// POST /api/v1/auth/otp/send
// Rate limited: 3 OTP requests per minute per phone
authRouter.post(
  '/otp/send',
  otpRateLimit,
  authRateLimit,
  validateBody(SendOtpSchema),
  authController.sendOtp,
);

// POST /api/v1/auth/otp/verify
authRouter.post(
  '/otp/verify',
  authRateLimit,
  validateBody(VerifyOtpSchema),
  auditLog('AUTH:OTP_VERIFY'),
  authController.verifyOtp,
);

// POST /api/v1/auth/token/refresh
authRouter.post(
  '/token/refresh',
  validateBody(RefreshTokenSchema),
  authController.refreshToken,
);

// POST /api/v1/auth/logout  (requires auth)
authRouter.post(
  '/logout',
  authenticate,
  auditLog('AUTH:LOGOUT'),
  authController.logout,
);

// PATCH /api/v1/auth/profile  (requires auth, new users complete profile)
authRouter.patch(
  '/profile',
  authenticate,
  validateBody(RegisterProfileSchema),
  auditLog('AUTH:PROFILE_COMPLETE'),
  authController.completeProfile,
);

// GET /api/v1/auth/me  (requires auth)
authRouter.get('/me', authenticate, authController.getMe);
