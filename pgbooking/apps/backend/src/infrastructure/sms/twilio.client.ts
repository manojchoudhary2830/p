import twilio from 'twilio';
import { env } from '@config/environment';
import { logger } from '@shared/utils/logger';
import { ExternalServiceError } from '@shared/errors';

let twilioClient: ReturnType<typeof twilio> | null = null;

function getClient() {
  if (!twilioClient) {
    twilioClient = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  }
  return twilioClient;
}

export async function sendSms(to: string, message: string): Promise<string> {
  try {
    const result = await getClient().messages.create({
      body: message,
      from: env.TWILIO_MESSAGING_SERVICE_SID
        ? undefined
        : env.TWILIO_PHONE_NUMBER,
      messagingServiceSid: env.TWILIO_MESSAGING_SERVICE_SID ?? undefined,
      to,
    });
    logger.info('SMS sent', { to: to.slice(-4), sid: result.sid });
    return result.sid;
  } catch (error) {
    const err = error as Error;
    logger.error('Twilio SMS failed', { error: err.message, to: to.slice(-4) });
    throw new ExternalServiceError('Twilio', err.message);
  }
}

export async function sendOtpSms(to: string, otp: string): Promise<void> {
  const message = `Your PG Booking OTP is: ${otp}. Valid for 5 minutes. Do not share this code with anyone.`;
  await sendSms(to, message);
}
