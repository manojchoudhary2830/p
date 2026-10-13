import { Request, Response, Router } from 'express';
import { query, queryOne, queryMany } from '@config/database';
import { sendSuccess, sendNoContent, parsePaginationParams, buildPaginatedResult, sendPaginated } from '@shared/utils/response';
import { authenticate } from '@shared/middleware/auth.middleware';
import { NotificationRow, NotificationType, NotificationChannel } from '@shared/types';
import { validateBody, validateParams } from '@shared/middleware/validation.middleware';
import { z } from 'zod';

// ─────────────────────────────────────────────
// Notification Service (shared utility)
// ─────────────────────────────────────────────

export async function createInAppNotification(params: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channel?: NotificationChannel;
}): Promise<string> {
  const result = await queryOne<{ id: string }>(
    `INSERT INTO notifications (user_id, type, channel, title, body, data, sent_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     RETURNING id`,
    [
      params.userId,
      params.type,
      params.channel ?? NotificationChannel.IN_APP,
      params.title,
      params.body,
      params.data ? JSON.stringify(params.data) : null,
    ],
  );
  return result!.id;
}

export async function broadcastToPropertyTenants(
  propertyId: string,
  notification: { type: NotificationType; title: string; body: string; data?: Record<string, unknown> },
): Promise<void> {
  await query(
    `INSERT INTO notifications (user_id, type, channel, title, body, data, sent_at)
     SELECT DISTINCT bk.tenant_user_id, $1, 'IN_APP', $2, $3, $4, NOW()
     FROM bookings bk
     JOIN beds b ON b.id = bk.assigned_bed_id
     JOIN rooms r ON r.id = b.room_parent_id
     WHERE r.property_parent_id = $5
       AND bk.current_booking_lifecycle_state = 'CONFIRMED'
       AND bk.deleted_at IS NULL`,
    [
      notification.type,
      notification.title,
      notification.body,
      notification.data ? JSON.stringify(notification.data) : null,
      propertyId,
    ],
  );
}

// ─────────────────────────────────────────────
// Controllers
// ─────────────────────────────────────────────

async function getMyNotifications(req: Request, res: Response): Promise<void> {
  const pagination = parsePaginationParams(req.query as Record<string, string>);
  const offset = (pagination.page - 1) * pagination.limit;
  const unreadOnly = req.query.unread === 'true';
  const unreadClause = unreadOnly ? 'AND is_read = FALSE' : '';

  const [rows, countRow] = await Promise.all([
    queryMany<NotificationRow>(
      `SELECT * FROM notifications
       WHERE user_id = $1 ${unreadClause}
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user!.id, pagination.limit, offset],
    ),
    queryOne<{ count: string }>(
      `SELECT COUNT(*) FROM notifications WHERE user_id = $1 ${unreadClause}`,
      [req.user!.id],
    ),
  ]);

  sendPaginated(res, buildPaginatedResult(rows, parseInt(countRow?.count ?? '0', 10), pagination));
}

async function getUnreadCount(req: Request, res: Response): Promise<void> {
  const row = await queryOne<{ count: string }>(
    `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE`,
    [req.user!.id],
  );
  sendSuccess(res, { unread_count: parseInt(row?.count ?? '0', 10) });
}

async function markAsRead(req: Request, res: Response): Promise<void> {
  const { ids } = req.body as { ids: string[] };
  await query(
    `UPDATE notifications
     SET is_read = TRUE, read_at = NOW()
     WHERE user_id = $1 AND id = ANY($2::uuid[])`,
    [req.user!.id, ids],
  );
  sendSuccess(res, null, 'Notifications marked as read');
}

async function markAllAsRead(req: Request, res: Response): Promise<void> {
  await query(
    `UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE user_id = $1 AND is_read = FALSE`,
    [req.user!.id],
  );
  sendSuccess(res, null, 'All notifications marked as read');
}

async function deleteNotification(req: Request, res: Response): Promise<void> {
  await query(
    `DELETE FROM notifications WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.user!.id],
  );
  sendNoContent(res);
}

async function updateFcmToken(req: Request, res: Response): Promise<void> {
  const { fcm_token } = req.body as { fcm_token: string };
  await query(
    `UPDATE users SET fcm_token = $1, record_updated_at = NOW() WHERE id = $2`,
    [fcm_token, req.user!.id],
  );
  sendSuccess(res, null, 'FCM token updated');
}

// ─────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────

export const notificationRouter = Router();

notificationRouter.get('/', authenticate, getMyNotifications);
notificationRouter.get('/unread-count', authenticate, getUnreadCount);
notificationRouter.post(
  '/mark-read',
  authenticate,
  validateBody(z.object({ ids: z.array(z.string().uuid()).min(1).max(100) })),
  markAsRead,
);
notificationRouter.post('/mark-all-read', authenticate, markAllAsRead);
notificationRouter.delete('/:id', authenticate, deleteNotification);
notificationRouter.put(
  '/fcm-token',
  authenticate,
  validateBody(z.object({ fcm_token: z.string().min(1).max(500) })),
  updateFcmToken,
);
