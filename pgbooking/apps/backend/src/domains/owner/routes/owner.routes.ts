import { Request, Response, Router } from 'express';
import { queryOne, queryMany } from '@config/database';
import { sendSuccess, parsePaginationParams, buildPaginatedResult, sendPaginated } from '@shared/utils/response';
import { authenticate } from '@shared/middleware/auth.middleware';
import { requireOwner } from '@shared/middleware/rbac.middleware';

async function getDashboardSummary(req: Request, res: Response): Promise<void> {
  const ownerId = req.user!.id;
  const [stats, revenueRow, pendingActions] = await Promise.all([
    queryOne<{ total_properties: string; total_beds: string; vacant_beds: string }>(`SELECT COUNT(DISTINCT p.id) AS total_properties, COALESCE(SUM(p.total_beds),0) AS total_beds, COALESCE(SUM(p.vacant_beds),0) AS vacant_beds FROM properties p WHERE p.landlord_owner_id = $1 AND p.deleted_at IS NULL`, [ownerId]),
    queryOne<{ this_month: string; last_month: string }>(`SELECT COALESCE(SUM(CASE WHEN DATE_TRUNC('month', p.transaction_timestamp) = DATE_TRUNC('month', NOW()) THEN p.exact_financial_amount END),0) AS this_month, COALESCE(SUM(CASE WHEN DATE_TRUNC('month', p.transaction_timestamp) = DATE_TRUNC('month', NOW() - INTERVAL '1 month') THEN p.exact_financial_amount END),0) AS last_month FROM payments p JOIN bookings bk ON bk.id = p.booking_context_id JOIN beds b ON b.id = bk.assigned_bed_id JOIN rooms r ON r.id = b.room_parent_id JOIN properties prop ON prop.id = r.property_parent_id WHERE prop.landlord_owner_id = $1 AND p.transaction_clearance_status = 'SUCCESSFUL'`, [ownerId]),
    queryOne<{ open_tickets: string; pending_bookings: string }>(`SELECT (SELECT COUNT(*) FROM maintenance_tickets mt JOIN bookings bk ON bk.id = mt.booking_id JOIN beds b ON b.id = bk.assigned_bed_id JOIN rooms r ON r.id = b.room_parent_id JOIN properties p ON p.id = r.property_parent_id WHERE p.landlord_owner_id = $1 AND mt.current_status IN ('OPEN','IN_PROGRESS')) AS open_tickets, (SELECT COUNT(*) FROM bookings bk JOIN beds b ON b.id = bk.assigned_bed_id JOIN rooms r ON r.id = b.room_parent_id JOIN properties p ON p.id = r.property_parent_id WHERE p.landlord_owner_id = $1 AND bk.current_booking_lifecycle_state = 'PENDING') AS pending_bookings`, [ownerId]),
  ]);
  const totalBeds = parseInt(stats?.total_beds ?? '0', 10);
  const vacantBeds = parseInt(stats?.vacant_beds ?? '0', 10);
  sendSuccess(res, {
    properties: { total: parseInt(stats?.total_properties ?? '0', 10), total_beds: totalBeds, vacant_beds: vacantBeds, occupied_beds: totalBeds - vacantBeds, occupancy_rate_percent: totalBeds > 0 ? Math.round(((totalBeds - vacantBeds) / totalBeds) * 100 * 10) / 10 : 0 },
    revenue: { this_month_inr: parseFloat(revenueRow?.this_month ?? '0'), last_month_inr: parseFloat(revenueRow?.last_month ?? '0') },
    pending_actions: { open_maintenance: parseInt(pendingActions?.open_tickets ?? '0', 10), pending_bookings: parseInt(pendingActions?.pending_bookings ?? '0', 10) },
  });
}

async function getRevenueChart(req: Request, res: Response): Promise<void> {
  const months = Math.min(24, parseInt(req.query.months as string ?? '6', 10));
  const rows = await queryMany<{ month: string; revenue: string; payment_count: string }>(`SELECT TO_CHAR(DATE_TRUNC('month', p.transaction_timestamp), 'YYYY-MM') AS month, COALESCE(SUM(p.exact_financial_amount),0) AS revenue, COUNT(*) AS payment_count FROM payments p JOIN bookings bk ON bk.id = p.booking_context_id JOIN beds b ON b.id = bk.assigned_bed_id JOIN rooms r ON r.id = b.room_parent_id JOIN properties prop ON prop.id = r.property_parent_id WHERE prop.landlord_owner_id = $1 AND p.transaction_clearance_status = 'SUCCESSFUL' AND p.transaction_timestamp >= DATE_TRUNC('month', NOW() - INTERVAL '1 month' * $2) GROUP BY 1 ORDER BY 1 ASC`, [req.user!.id, months]);
  sendSuccess(res, rows.map((r) => ({ month: r.month, revenue: parseFloat(r.revenue), payment_count: parseInt(r.payment_count, 10) })));
}

async function getTenants(req: Request, res: Response): Promise<void> {
  const pagination = parsePaginationParams(req.query as Record<string, string>);
  const offset = (pagination.page - 1) * pagination.limit;
  const [rows, countRow] = await Promise.all([
    queryMany(`SELECT DISTINCT ON (u.id) u.id, u.legal_full_name, u.phone_number, u.email_address, u.identity_kyc_status, bk.id AS booking_id, bk.current_booking_lifecycle_state AS booking_status, bk.scheduled_check_in_date, bk.monthly_rent_amount, p.property_display_name, r.room_identifier_code, b.bed_spatial_code FROM users u JOIN bookings bk ON bk.tenant_user_id = u.id AND bk.current_booking_lifecycle_state = 'CONFIRMED' JOIN beds b ON b.id = bk.assigned_bed_id JOIN rooms r ON r.id = b.room_parent_id JOIN properties p ON p.id = r.property_parent_id WHERE p.landlord_owner_id = $1 AND bk.deleted_at IS NULL ORDER BY u.id, bk.created_at DESC LIMIT $2 OFFSET $3`, [req.user!.id, pagination.limit, offset]),
    queryOne<{ count: string }>(`SELECT COUNT(DISTINCT u.id) FROM users u JOIN bookings bk ON bk.tenant_user_id = u.id AND bk.current_booking_lifecycle_state = 'CONFIRMED' JOIN beds b ON b.id = bk.assigned_bed_id JOIN rooms r ON r.id = b.room_parent_id JOIN properties p ON p.id = r.property_parent_id WHERE p.landlord_owner_id = $1 AND bk.deleted_at IS NULL`, [req.user!.id]),
  ]);
  sendPaginated(res, buildPaginatedResult(rows, parseInt(countRow?.count ?? '0', 10), pagination));
}

async function getRentDue(req: Request, res: Response): Promise<void> {
  const rows = await queryMany(`SELECT bk.id AS booking_id, bk.monthly_rent_amount, u.legal_full_name AS tenant_name, u.phone_number AS tenant_phone, p.property_display_name, r.room_identifier_code, b.bed_spatial_code, (SELECT transaction_clearance_status FROM payments pay WHERE pay.booking_context_id = bk.id AND pay.financial_payment_purpose = 'MONTHLY_RENT' AND TO_CHAR(pay.transaction_timestamp, 'YYYY-MM') = TO_CHAR(NOW(), 'YYYY-MM') LIMIT 1) AS current_month_status FROM bookings bk JOIN users u ON u.id = bk.tenant_user_id JOIN beds b ON b.id = bk.assigned_bed_id JOIN rooms r ON r.id = b.room_parent_id JOIN properties p ON p.id = r.property_parent_id WHERE p.landlord_owner_id = $1 AND bk.current_booking_lifecycle_state = 'CONFIRMED' AND bk.deleted_at IS NULL ORDER BY p.property_display_name, r.room_identifier_code`, [req.user!.id]);
  sendSuccess(res, rows);
}

export const ownerRouter = Router();
ownerRouter.use(authenticate, requireOwner);
ownerRouter.get('/dashboard', getDashboardSummary);
ownerRouter.get('/revenue', getRevenueChart);
ownerRouter.get('/tenants', getTenants);
ownerRouter.get('/rent-due', getRentDue);
