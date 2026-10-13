import * as admin from 'firebase-admin';
import { env } from '@config/environment';
import { logger } from '@shared/utils/logger';
import { ExternalServiceError } from '@shared/errors';

// ─────────────────────────────────────────────
// Firebase Admin initialization (singleton)
// ─────────────────────────────────────────────

let initialized = false;

function getApp(): admin.app.App {
  if (!initialized) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId:    env.FIREBASE_PROJECT_ID,
        privateKeyId: env.FIREBASE_PRIVATE_KEY_ID,
        privateKey:   env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        clientEmail:  env.FIREBASE_CLIENT_EMAIL,
        clientId:     env.FIREBASE_CLIENT_ID,
      } as admin.ServiceAccount),
    });
    initialized = true;
    logger.info('Firebase Admin SDK initialized');
  }
  return admin.app();
}

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

// ─────────────────────────────────────────────
// Send to a single device token
// ─────────────────────────────────────────────

export async function sendPush(fcmToken: string, payload: PushPayload): Promise<string | null> {
  try {
    const app = getApp();
    const messageId = await admin.messaging(app).send({
      token: fcmToken,
      notification: {
        title: payload.title,
        body: payload.body,
        imageUrl: payload.imageUrl,
      },
      data: payload.data ?? {},
      android: {
        priority: 'high',
        notification: { channelId: 'pgbooking_default', sound: 'default' },
      },
      apns: {
        payload: { aps: { sound: 'default', badge: 1 } },
      },
    });
    logger.info('Push notification sent', { messageId, title: payload.title });
    return messageId;
  } catch (error) {
    const err = error as Error & { code?: string };
    // Unregistered token — caller should remove from DB
    if (err.code === 'messaging/registration-token-not-registered' ||
        err.code === 'messaging/invalid-registration-token') {
      logger.warn('FCM token invalid/unregistered', { fcmToken: fcmToken.slice(-6) });
      return null;
    }
    logger.error('Push notification failed', { error: err.message, code: err.code });
    throw new ExternalServiceError('Firebase FCM', err.message);
  }
}

// ─────────────────────────────────────────────
// Send to a user (looks up their FCM tokens)
// ─────────────────────────────────────────────

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  const { queryMany, query } = await import('@config/database');

  const tokenRows = await queryMany<{ id: string; fcm_token: string }>(
    `SELECT id, fcm_token FROM user_fcm_tokens
     WHERE user_id = $1 AND is_active = TRUE`,
    [userId],
  );

  if (tokenRows.length === 0) {
    logger.debug('No FCM tokens for user — skipping push', { userId });
    return;
  }

  const staleTokenIds: string[] = [];

  await Promise.allSettled(
    tokenRows.map(async (row) => {
      const messageId = await sendPush(row.fcm_token, payload);
      if (messageId === null) staleTokenIds.push(row.id); // null = stale token
    }),
  );

  // Deactivate stale tokens
  if (staleTokenIds.length > 0) {
    await query(
      `UPDATE user_fcm_tokens SET is_active = FALSE WHERE id = ANY($1::uuid[])`,
      [staleTokenIds],
    );
    logger.info(`Deactivated ${staleTokenIds.length} stale FCM token(s)`, { userId });
  }
}

// ─────────────────────────────────────────────
// Multicast — send to multiple tokens at once
// ─────────────────────────────────────────────

export async function sendPushMulticast(fcmTokens: string[], payload: PushPayload): Promise<void> {
  if (fcmTokens.length === 0) return;

  try {
    const app = getApp();
    const response = await admin.messaging(app).sendEachForMulticast({
      tokens: fcmTokens,
      notification: { title: payload.title, body: payload.body },
      data: payload.data ?? {},
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default' } } },
    });

    logger.info('Push multicast sent', {
      success: response.successCount,
      failure: response.failureCount,
      total: fcmTokens.length,
    });
  } catch (error) {
    logger.error('Push multicast failed', { error: (error as Error).message });
    throw new ExternalServiceError('Firebase FCM', (error as Error).message);
  }
}
