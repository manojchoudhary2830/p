import { Request, Response, Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { queryOne, queryMany } from '@config/database';
import { uploadFile, getSignedDownloadUrl } from '@infrastructure/storage/s3.client';
import { dispatchPush } from '@infrastructure/queue/bullmq.client';
import { sendSuccess, sendCreated, parsePaginationParams, buildPaginatedResult, sendPaginated } from '@shared/utils/response';
import { validateBody, validateParams } from '@shared/middleware/validation.middleware';
import { authenticate } from '@shared/middleware/auth.middleware';
import { requireOwnerOrAdmin } from '@shared/middleware/rbac.middleware';
import { auditLog } from '@shared/middleware/audit.middleware';
import { uploadRateLimit } from '@shared/middleware/rate-limit.middleware';
import { NotFoundError, ForbiddenError, BadRequestError } from '@shared/errors';
import { MaintenanceStatus, MaintenanceCategory, MaintenanceTicketRow, UserRole } from '@shared/types';
import { env } from '@config/environment';

const CreateTicketSchema = z.object({
  booking_id: z.string().uuid(),
  title: z.string().trim().min(5).max(200),
  description: z.string().trim().min(10).max(2000),
  category: z.nativeEnum(MaintenanceCategory).default(MaintenanceCategory.OTHER),
  priority: z.number().int().min(1).max(5).default(2),
});

const UpdateTicketStatusSchema = z.object({
  status: z.nativeEnum(MaintenanceStatus),
  resolution_notes: z.string().trim().max(1000).optional(),
});

const AddCommentSchema = z.object({
  content: z.string().trim().min(1).max(1000),
  is_internal: z.boolean().default(false),
});

const TicketIdParam = z.object({ id: z.string().uuid() });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.UPLOAD_MAX_FILE_SIZE_MB * 1024 * 1024, files: 3 },
  fileFilter: (_req: any, file: { mimetype: string }, cb: (error: Error | null, acceptFile: boolean) => void) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) cb(null, true);
    else cb(new BadRequestError('Only image files allowed'), false as any);
  },
});

async function createTicket(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { booking_id, title, description, category, priority } = req.body as z.infer<typeof CreateTicketSchema>;
  const booking = await queryOne<{ tenant_user_id: string; assigned_owner_id: string }>(
    `SELECT bk.tenant_user_id, p.landlord_owner_id AS assigned_owner_id FROM bookings bk JOIN beds b ON b.id = bk.assigned_bed_id JOIN rooms r ON r.id = b.room_parent_id JOIN properties p ON p.id = r.property_parent_id WHERE bk.id = $1 AND bk.deleted_at IS NULL`, [booking_id]);
  if (!booking) throw new NotFoundError('Booking', booking_id);
  if (booking.tenant_user_id !== userId) throw new ForbiddenError('You can only file tickets for your own bookings');
  const files = (req as Request & { files?: { mimetype: string; fieldname: string; originalname: string; buffer: Buffer; size: number }[] }).files ?? [];
  const photoKeys: string[] = [];
  for (const file of files) {
    const result = await uploadFile({ bucket: 'maintenance', buffer: file.buffer, originalName: file.originalname, contentType: file.mimetype, folder: `maintenance/${booking_id}`, compress: true });
    photoKeys.push(result.key);
  }
  const ticket = await queryOne<MaintenanceTicketRow>(`INSERT INTO maintenance_tickets (booking_id, reported_by_user_id, assigned_to_owner_id, title, description, category, photo_s3_keys, priority) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [booking_id, userId, booking.assigned_owner_id, title, description, category, photoKeys, priority]);
  await dispatchPush({ userId: booking.assigned_owner_id, title: 'New Maintenance Request', body: title, data: { ticket_id: ticket!.id, type: 'MAINTENANCE_CREATED' } });
  sendCreated(res, ticket, 'Ticket created');
}

async function getMyTickets(req: Request, res: Response): Promise<void> {
  const rows = await queryMany(`SELECT mt.*, p.property_display_name, r.room_identifier_code FROM maintenance_tickets mt JOIN bookings bk ON bk.id = mt.booking_id JOIN beds b ON b.id = bk.assigned_bed_id JOIN rooms r ON r.id = b.room_parent_id JOIN properties p ON p.id = r.property_parent_id WHERE mt.reported_by_user_id = $1 ORDER BY mt.created_at DESC`, [req.user!.id]);
  sendSuccess(res, rows);
}

async function getTicketDetail(req: Request, res: Response): Promise<void> {
  const ticket = await queryOne<MaintenanceTicketRow & { property_display_name: string; reporter_name: string; photo_s3_keys: string[] }>(`SELECT mt.*, p.property_display_name, r.room_identifier_code, u.legal_full_name AS reporter_name FROM maintenance_tickets mt JOIN bookings bk ON bk.id = mt.booking_id JOIN beds b ON b.id = bk.assigned_bed_id JOIN rooms r ON r.id = b.room_parent_id JOIN properties p ON p.id = r.property_parent_id JOIN users u ON u.id = mt.reported_by_user_id WHERE mt.id = $1`, [req.params.id]);
  if (!ticket) throw new NotFoundError('Ticket', req.params.id);
  const isOwnerOrAdmin = [UserRole.OWNER, UserRole.SYSTEM_ADMIN].includes(req.user!.role);
  const photoUrls = await Promise.all((ticket.photo_s3_keys ?? []).map((k: string) => getSignedDownloadUrl('maintenance', k).catch(() => null)));
  const comments = await queryMany(`SELECT mc.*, u.legal_full_name AS author_name FROM maintenance_comments mc JOIN users u ON u.id = mc.author_id WHERE mc.ticket_id = $1 AND (mc.is_internal = FALSE OR $2 = TRUE) ORDER BY mc.created_at ASC`, [req.params.id, isOwnerOrAdmin]);
  sendSuccess(res, { ...ticket, photo_urls: photoUrls.filter(Boolean), comments });
}

async function updateStatus(req: Request, res: Response): Promise<void> {
  const { status, resolution_notes } = req.body as z.infer<typeof UpdateTicketStatusSchema>;
  const ticket = await queryOne<MaintenanceTicketRow & { assigned_to_owner_id: string; reported_by_user_id: string }>(`SELECT * FROM maintenance_tickets WHERE id = $1`, [req.params.id]);
  if (!ticket) throw new NotFoundError('Ticket', req.params.id);
  if (req.user!.role === UserRole.OWNER && ticket.assigned_to_owner_id !== req.user!.id) throw new ForbiddenError();
  const updated = await queryOne<MaintenanceTicketRow>(`UPDATE maintenance_tickets SET current_status=$1, resolution_notes=COALESCE($2,resolution_notes), resolved_at=CASE WHEN $1='RESOLVED' THEN NOW() ELSE resolved_at END, closed_at=CASE WHEN $1='CLOSED' THEN NOW() ELSE closed_at END, updated_at=NOW() WHERE id=$3 RETURNING *`, [status, resolution_notes ?? null, req.params.id]);
  await dispatchPush({ userId: ticket.reported_by_user_id, title: 'Maintenance Update', body: `"${ticket.title}" is now ${status}`, data: { ticket_id: ticket.id, type: 'MAINTENANCE_UPDATED' } });
  sendSuccess(res, updated, 'Status updated');
}

async function addComment(req: Request, res: Response): Promise<void> {
  const { content, is_internal } = req.body as z.infer<typeof AddCommentSchema>;
  if (is_internal && req.user!.role === UserRole.TENANT) throw new ForbiddenError('Tenants cannot post internal notes');
  const comment = await queryOne(`INSERT INTO maintenance_comments (ticket_id, author_id, content, is_internal) VALUES ($1,$2,$3,$4) RETURNING *`, [req.params.id, req.user!.id, content, is_internal]);
  sendCreated(res, comment);
}

async function getOwnerTickets(req: Request, res: Response): Promise<void> {
  const pagination = parsePaginationParams(req.query as Record<string, string>);
  const offset = (pagination.page - 1) * pagination.limit;
  const status = req.query.status as MaintenanceStatus | undefined;
  const statusClause = status ? `AND mt.current_status = '${status}'` : '';
  const [rows, countRow] = await Promise.all([
    queryMany(`SELECT mt.*, u.legal_full_name AS reporter_name, p.property_display_name, r.room_identifier_code FROM maintenance_tickets mt JOIN users u ON u.id = mt.reported_by_user_id JOIN bookings bk ON bk.id = mt.booking_id JOIN beds b ON b.id = bk.assigned_bed_id JOIN rooms r ON r.id = b.room_parent_id JOIN properties p ON p.id = r.property_parent_id WHERE p.landlord_owner_id = $1 ${statusClause} ORDER BY mt.priority DESC, mt.created_at ASC LIMIT $2 OFFSET $3`, [req.user!.id, pagination.limit, offset]),
    queryOne<{ count: string }>(`SELECT COUNT(*) FROM maintenance_tickets mt JOIN bookings bk ON bk.id = mt.booking_id JOIN beds b ON b.id = bk.assigned_bed_id JOIN rooms r ON r.id = b.room_parent_id JOIN properties p ON p.id = r.property_parent_id WHERE p.landlord_owner_id = $1`, [req.user!.id]),
  ]);
  sendPaginated(res, buildPaginatedResult(rows, parseInt(countRow?.count ?? '0', 10), pagination));
}

export const maintenanceRouter = Router();
maintenanceRouter.get('/mine', authenticate, getMyTickets);
maintenanceRouter.get('/owner', authenticate, requireOwnerOrAdmin, getOwnerTickets);
maintenanceRouter.post('/', authenticate, uploadRateLimit, upload.array('photos', 3), validateBody(CreateTicketSchema), auditLog('MAINTENANCE:CREATE'), createTicket);
maintenanceRouter.get('/:id', authenticate, validateParams(TicketIdParam), getTicketDetail);
maintenanceRouter.patch('/:id/status', authenticate, requireOwnerOrAdmin, validateParams(TicketIdParam), validateBody(UpdateTicketStatusSchema), auditLog('MAINTENANCE:STATUS_UPDATE'), updateStatus);
maintenanceRouter.post('/:id/comments', authenticate, validateParams(TicketIdParam), validateBody(AddCommentSchema), addComment);
