import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { query, queryOne, queryMany } from '@config/database';
import { sendSuccess, sendCreated, sendNoContent } from '@shared/utils/response';
import { validateBody } from '@shared/middleware/validation.middleware';
import { authenticate } from '@shared/middleware/auth.middleware';
import { requireRole } from '@shared/middleware/rbac.middleware';
import { auditLog } from '@shared/middleware/audit.middleware';
import { NotFoundError, BadRequestError, ForbiddenError } from '@shared/errors';
import { BedStatus, UserRole } from '@shared/types';

// ─────────────────────────────────────────────
// Validators
// ─────────────────────────────────────────────

const CreateBedSchema = z.object({
  beds: z.array(z.object({
    bed_spatial_code: z.string().trim().min(1).max(10),
  })).min(1).max(20),
});

const UpdateBedSchema = z.object({
  bed_spatial_code: z.string().trim().min(1).max(10).optional(),
  current_occupancy_status: z.nativeEnum(BedStatus).optional(),
});

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

async function assertRoomOwner(roomId: string, userId: string, isAdmin: boolean): Promise<void> {
  const room = await queryOne<{ landlord_owner_id: string }>(
    `SELECT p.landlord_owner_id
     FROM rooms r
     JOIN properties p ON p.id = r.property_parent_id
     WHERE r.id = $1 AND r.deleted_at IS NULL`,
    [roomId],
  );
  if (!room) throw new NotFoundError('Room', roomId);
  if (!isAdmin && room.landlord_owner_id !== userId) throw new ForbiddenError('You do not own this room');
}

// ─────────────────────────────────────────────
// Handlers
// ─────────────────────────────────────────────

async function listBeds(req: Request, res: Response): Promise<void> {
  const { roomId } = req.params;
  const beds = await queryMany(
    `SELECT id, bed_spatial_code, current_occupancy_status, last_modified_timestamp
     FROM beds WHERE room_parent_id = $1 ORDER BY bed_spatial_code ASC`,
    [roomId],
  );
  sendSuccess(res, beds);
}

async function getBed(req: Request, res: Response): Promise<void> {
  const { bedId } = req.params;
  const bed = await queryOne(
    `SELECT b.id, b.bed_spatial_code, b.current_occupancy_status, b.last_modified_timestamp,
            r.room_identifier_code, r.standard_monthly_rent_amount, r.required_security_deposit_amount,
            r.token_deposit_amount, r.max_occupancy_sharing_limit
     FROM beds b
     JOIN rooms r ON r.id = b.room_parent_id
     WHERE b.id = $1`,
    [bedId],
  );
  if (!bed) throw new NotFoundError('Bed', bedId);
  sendSuccess(res, bed);
}

async function createBeds(req: Request, res: Response): Promise<void> {
  const { roomId } = req.params;
  const { beds } = req.body as z.infer<typeof CreateBedSchema>;
  const isAdmin = req.user!.role === UserRole.SYSTEM_ADMIN;
  await assertRoomOwner(roomId, req.user!.id, isAdmin);

  // Check for duplicate codes within request
  const codes = beds.map((b: { bed_spatial_code: string }) => b.bed_spatial_code.toUpperCase());
  if (new Set(codes).size !== codes.length) {
    throw new BadRequestError('Duplicate bed codes in request');
  }

  // Check for existing codes in this room
  const existing = await queryMany<{ bed_spatial_code: string }>(
    `SELECT bed_spatial_code FROM beds WHERE room_parent_id = $1`,
    [roomId],
  );
  const existingCodes = existing.map((b: { bed_spatial_code: string }) => b.bed_spatial_code.toUpperCase());
  const conflicts = codes.filter((c: string) => existingCodes.includes(c));
  if (conflicts.length > 0) {
    throw new BadRequestError(`Bed codes already exist in this room: ${conflicts.join(', ')}`);
  }

  const placeholders = beds.map((_: unknown, i: number) => `($1, $${i + 2}, 'VACANT')`).join(', ');
  const values = [roomId, ...codes];
  const created = await queryMany(
    `INSERT INTO beds (room_parent_id, bed_spatial_code, current_occupancy_status)
     VALUES ${placeholders}
     RETURNING id, bed_spatial_code, current_occupancy_status`,
    values,
  );
  sendCreated(res, created, `${created.length} bed(s) created`);
}

async function updateBed(req: Request, res: Response): Promise<void> {
  const { roomId, bedId } = req.params;
  const isAdmin = req.user!.role === UserRole.SYSTEM_ADMIN;
  await assertRoomOwner(roomId, req.user!.id, isAdmin);

  const bed = await queryOne<{ current_occupancy_status: string }>(
    `SELECT current_occupancy_status FROM beds WHERE id = $1 AND room_parent_id = $2`,
    [bedId, roomId],
  );
  if (!bed) throw new NotFoundError('Bed', bedId);

  const { bed_spatial_code, current_occupancy_status } = req.body as z.infer<typeof UpdateBedSchema>;

  // Safety: only admin can manually override OCCUPIED status
  if (current_occupancy_status === BedStatus.OCCUPIED && !isAdmin) {
    throw new ForbiddenError('Only admins can manually mark a bed as OCCUPIED');
  }

  const updated = await queryOne(
    `UPDATE beds SET
       bed_spatial_code = COALESCE($1, bed_spatial_code),
       current_occupancy_status = COALESCE($2, current_occupancy_status),
       last_modified_timestamp = NOW()
     WHERE id = $3
     RETURNING id, bed_spatial_code, current_occupancy_status`,
    [bed_spatial_code?.toUpperCase() ?? null, current_occupancy_status ?? null, bedId],
  );
  sendSuccess(res, updated, 'Bed updated');
}

async function deleteBed(req: Request, res: Response): Promise<void> {
  const { roomId, bedId } = req.params;
  const isAdmin = req.user!.role === UserRole.SYSTEM_ADMIN;
  await assertRoomOwner(roomId, req.user!.id, isAdmin);

  const bed = await queryOne<{ current_occupancy_status: string }>(
    `SELECT current_occupancy_status FROM beds WHERE id = $1 AND room_parent_id = $2`,
    [bedId, roomId],
  );
  if (!bed) throw new NotFoundError('Bed', bedId);
  if (bed.current_occupancy_status !== 'VACANT') {
    throw new BadRequestError('Cannot delete a bed that is not VACANT. Cancel any active booking first.');
  }

  await query(`DELETE FROM beds WHERE id = $1`, [bedId]);
  sendNoContent(res);
}

// ─────────────────────────────────────────────
// Router — mounted at /rooms/:roomId/beds
// ─────────────────────────────────────────────

export const bedRouter = Router({ mergeParams: true });

bedRouter.get('/',           authenticate, listBeds);
bedRouter.get('/:bedId',     authenticate, getBed);
bedRouter.post('/',          authenticate, requireRole(UserRole.OWNER, UserRole.SYSTEM_ADMIN), validateBody(CreateBedSchema), auditLog('BED:CREATE'), createBeds);
bedRouter.patch('/:bedId',   authenticate, requireRole(UserRole.OWNER, UserRole.SYSTEM_ADMIN), validateBody(UpdateBedSchema), auditLog('BED:UPDATE'), updateBed);
bedRouter.delete('/:bedId',  authenticate, requireRole(UserRole.OWNER, UserRole.SYSTEM_ADMIN), auditLog('BED:DELETE'), deleteBed);
