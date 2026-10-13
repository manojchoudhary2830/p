import { Request, Response, Router } from 'express';
import { query, queryOne, queryMany } from '@config/database';
import { sendSuccess, parsePaginationParams, buildPaginatedResult, sendPaginated } from '@shared/utils/response';
import { authenticate } from '@shared/middleware/auth.middleware';
import { requireAdmin } from '@shared/middleware/rbac.middleware';
import { validateBody, validateParams } from '@shared/middleware/validation.middleware';
import { auditLog } from '@shared/middleware/audit.middleware';
import { z } from 'zod';
import { NotFoundError } from '@shared/errors';

// ─── Validators ───────────────────────────────
const VerifyPropertySchema = z.object({ status: z.enum(['VERIFIED','REJECTED','SUSPENDED']), notes: z.string().trim().max(500).optional() });
const KycReviewSchema = z.object({ status: z.enum(['VERIFIED','REJECTED']), rejection_reason: z.string().trim().max(500).optional() });
const UpdateUserRoleSchema = z.object({ role: z.enum(['TENANT','OWNER','SYSTEM_ADMIN']) });

// ─── System Stats ─────────────────────────────
async function getSystemStats(req: Request, res: Response): Promise<void> {
  const [users, properties, bookings, revenue] = await Promise.all([
    queryOne<{ total: string; tenants: string; owners: string; admins: string }>(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE account_role='TENANT') AS tenants, COUNT(*) FILTER (WHERE account_role='OWNER') AS owners, COUNT(*) FILTER (WHERE account_role='SYSTEM_ADMIN') AS admins FROM users WHERE deleted_at IS NULL`, []),
    queryOne<{ total: string; verified: string; pending: string }>(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE verification_status='VERIFIED') AS verified, COUNT(*) FILTER (WHERE verification_status='PENDING') AS pending FROM properties WHERE deleted_at IS NULL`, []),
    queryOne<{ total: string; confirmed: string; pending: string; cancelled: string }>(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE current_booking_lifecycle_state='CONFIRMED') AS confirmed, COUNT(*) FILTER (WHERE current_booking_lifecycle_state='PENDING') AS pending, COUNT(*) FILTER (WHERE current_booking_lifecycle_state='CANCELLED') AS cancelled FROM bookings WHERE deleted_at IS NULL`, []),
    queryOne<{ total_revenue: string; this_month: string }>(`SELECT COALESCE(SUM(exact_financial_amount),0) AS total_revenue, COALESCE(SUM(CASE WHEN DATE_TRUNC('month',transaction_timestamp)=DATE_TRUNC('month',NOW()) THEN exact_financial_amount END),0) AS this_month FROM payments WHERE transaction_clearance_status='SUCCESSFUL'`, []),
  ]);
  sendSuccess(res, { users, properties, bookings, revenue });
}

// ─── User Management ──────────────────────────
async function listUsers(req: Request, res: Response): Promise<void> {
  const pagination = parsePaginationParams(req.query as Record<string, string>);
  const offset = (pagination.page - 1) * pagination.limit;
  const role = req.query.role as string | undefined;
  const search = req.query.search as string | undefined;
  const roleClause = role ? `AND account_role = '${role}'` : '';
  const searchClause = search ? `AND (legal_full_name ILIKE '%${search}%' OR phone_number ILIKE '%${search}%')` : '';
  const [rows, countRow] = await Promise.all([
    queryMany(`SELECT id, phone_number, email_address, legal_full_name, account_role, identity_kyc_status, is_active, last_login_at, record_created_at FROM users WHERE deleted_at IS NULL ${roleClause} ${searchClause} ORDER BY record_created_at DESC LIMIT $1 OFFSET $2`, [pagination.limit, offset]),
    queryOne<{ count: string }>(`SELECT COUNT(*) FROM users WHERE deleted_at IS NULL ${roleClause} ${searchClause}`, []),
  ]);
  sendPaginated(res, buildPaginatedResult(rows, parseInt(countRow?.count ?? '0', 10), pagination));
}

async function toggleUserStatus(req: Request, res: Response): Promise<void> {
  const row = await queryOne<{ id: string; is_active: boolean }>(`SELECT id, is_active FROM users WHERE id = $1 AND deleted_at IS NULL`, [req.params.id]);
  if (!row) throw new NotFoundError('User', req.params.id);
  await query(`UPDATE users SET is_active = NOT is_active, record_updated_at = NOW() WHERE id = $1`, [req.params.id]);
  sendSuccess(res, null, `User ${row.is_active ? 'deactivated' : 'activated'}`);
}

async function updateUserRole(req: Request, res: Response): Promise<void> {
  const { role } = req.body as { role: string };
  const user = await queryOne(`UPDATE users SET account_role = $1, record_updated_at = NOW() WHERE id = $2 AND deleted_at IS NULL RETURNING id, account_role`, [role, req.params.id]);
  if (!user) throw new NotFoundError('User', req.params.id);
  sendSuccess(res, user, 'Role updated');
}

// ─── Property Verification ────────────────────
async function getPendingProperties(req: Request, res: Response): Promise<void> {
  const pagination = parsePaginationParams(req.query as Record<string, string>);
  const offset = (pagination.page - 1) * pagination.limit;
  const [rows, countRow] = await Promise.all([
    queryMany(`SELECT p.*, u.legal_full_name AS owner_name, u.phone_number AS owner_phone, (SELECT COUNT(*) FROM property_photos pp WHERE pp.property_id = p.id) AS photo_count FROM properties p JOIN users u ON u.id = p.landlord_owner_id WHERE p.verification_status = 'PENDING' AND p.deleted_at IS NULL ORDER BY p.created_at ASC LIMIT $1 OFFSET $2`, [pagination.limit, offset]),
    queryOne<{ count: string }>(`SELECT COUNT(*) FROM properties WHERE verification_status = 'PENDING' AND deleted_at IS NULL`, []),
  ]);
  sendPaginated(res, buildPaginatedResult(rows, parseInt(countRow?.count ?? '0', 10), pagination));
}

async function verifyProperty(req: Request, res: Response): Promise<void> {
  const { status, notes } = req.body as { status: string; notes?: string };
  const updated = await queryOne(`UPDATE properties SET verification_status = $1, verification_notes = $2, verified_by_admin_id = $3, verified_at = NOW(), is_listing_verified_by_admin = ($1 = 'VERIFIED'), updated_at = NOW() WHERE id = $4 AND deleted_at IS NULL RETURNING id, property_display_name, verification_status`, [status, notes ?? null, req.user!.id, req.params.id]);
  if (!updated) throw new NotFoundError('Property', req.params.id);
  sendSuccess(res, updated, `Property ${status.toLowerCase()}`);
}

// ─── KYC Management ───────────────────────────
async function getPendingKyc(req: Request, res: Response): Promise<void> {
  const pagination = parsePaginationParams(req.query as Record<string, string>);
  const offset = (pagination.page - 1) * pagination.limit;
  const [rows, countRow] = await Promise.all([
    queryMany(`SELECT kd.*, u.legal_full_name, u.phone_number, u.email_address FROM kyc_documents kd JOIN users u ON u.id = kd.user_id WHERE kd.verification_status = 'PENDING_REVIEW' ORDER BY kd.created_at ASC LIMIT $1 OFFSET $2`, [pagination.limit, offset]),
    queryOne<{ count: string }>(`SELECT COUNT(*) FROM kyc_documents WHERE verification_status = 'PENDING_REVIEW'`, []),
  ]);
  sendPaginated(res, buildPaginatedResult(rows, parseInt(countRow?.count ?? '0', 10), pagination));
}

async function reviewKyc(req: Request, res: Response): Promise<void> {
  const { status, rejection_reason } = req.body as { status: string; rejection_reason?: string };
  const updated = await queryOne(`UPDATE kyc_documents SET verification_status = $1, rejection_reason = $2, reviewed_by = $3, reviewed_at = NOW(), updated_at = NOW() WHERE id = $4 RETURNING id, verification_status, user_id`, [status, rejection_reason ?? null, req.user!.id, req.params.id]);
  if (!updated) throw new NotFoundError('KYC Document', req.params.id);
  sendSuccess(res, updated, `KYC ${status.toLowerCase()}`);
}

// ─── Payment Monitoring ───────────────────────
async function getPaymentLedger(req: Request, res: Response): Promise<void> {
  const pagination = parsePaginationParams(req.query as Record<string, string>);
  const offset = (pagination.page - 1) * pagination.limit;
  const status = req.query.status as string | undefined;
  const purpose = req.query.purpose as string | undefined;
  const statusClause = status ? `AND p.transaction_clearance_status = '${status}'` : '';
  const purposeClause = purpose ? `AND p.financial_payment_purpose = '${purpose}'` : '';
  const [rows, countRow] = await Promise.all([
    queryMany(`SELECT p.id, p.exact_financial_amount, p.currency_code, p.transaction_clearance_status, p.financial_payment_purpose, p.payment_gateway_order_id, p.payment_gateway_external_id, p.transaction_timestamp, u.legal_full_name AS payer_name, u.phone_number AS payer_phone FROM payments p JOIN users u ON u.id = p.payer_user_id WHERE 1=1 ${statusClause} ${purposeClause} ORDER BY p.transaction_timestamp DESC LIMIT $1 OFFSET $2`, [pagination.limit, offset]),
    queryOne<{ count: string; total_amount: string }>(`SELECT COUNT(*) AS count, COALESCE(SUM(exact_financial_amount),0) AS total_amount FROM payments WHERE 1=1 ${statusClause} ${purposeClause}`, []),
  ]);
  const result = buildPaginatedResult(rows, parseInt(countRow?.count ?? '0', 10), pagination);
  res.json({ status: 'success', ...result, meta: { ...result.meta, total_amount_inr: parseFloat(countRow?.total_amount ?? '0') } });
}

// ─── Audit Logs ───────────────────────────────
async function getAuditLogs(req: Request, res: Response): Promise<void> {
  const pagination = parsePaginationParams(req.query as Record<string, string>);
  const offset = (pagination.page - 1) * pagination.limit;
  const userId = req.query.user_id as string | undefined;
  const userClause = userId ? `AND al.user_id = '${userId}'` : '';
  const [rows, countRow] = await Promise.all([
    queryMany(`SELECT al.*, u.legal_full_name AS user_name FROM audit_logs al LEFT JOIN users u ON u.id = al.user_id WHERE 1=1 ${userClause} ORDER BY al.created_at DESC LIMIT $1 OFFSET $2`, [pagination.limit, offset]),
    queryOne<{ count: string }>(`SELECT COUNT(*) FROM audit_logs WHERE 1=1 ${userClause}`, []),
  ]);
  sendPaginated(res, buildPaginatedResult(rows, parseInt(countRow?.count ?? '0', 10), pagination));
}

// ─── Router ───────────────────────────────────
export const adminRouter = Router();
adminRouter.use(authenticate, requireAdmin);

adminRouter.get('/stats', getSystemStats);
adminRouter.get('/users', listUsers);
adminRouter.patch('/users/:id/toggle-status', validateParams(z.object({ id: z.string().uuid() })), auditLog('ADMIN:USER_TOGGLE'), toggleUserStatus);
adminRouter.patch('/users/:id/role', validateParams(z.object({ id: z.string().uuid() })), validateBody(UpdateUserRoleSchema), auditLog('ADMIN:ROLE_UPDATE'), updateUserRole);
adminRouter.get('/properties/pending', getPendingProperties);
adminRouter.patch('/properties/:id/verify', validateParams(z.object({ id: z.string().uuid() })), validateBody(VerifyPropertySchema), auditLog('ADMIN:PROPERTY_VERIFY'), verifyProperty);
adminRouter.get('/kyc/pending', getPendingKyc);
adminRouter.patch('/kyc/:id/review', validateParams(z.object({ id: z.string().uuid() })), validateBody(KycReviewSchema), auditLog('ADMIN:KYC_REVIEW'), reviewKyc);
adminRouter.get('/payments', getPaymentLedger);
adminRouter.get('/audit-logs', getAuditLogs);
