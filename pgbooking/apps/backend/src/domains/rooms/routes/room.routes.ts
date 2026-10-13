import { z } from 'zod';
import { Router, Request, Response } from 'express';
import { query, queryOne, queryMany } from '@config/database';
import { sendSuccess, sendCreated, sendNoContent } from '@shared/utils/response';
import { validateBody, validateParams } from '@shared/middleware/validation.middleware';
import { authenticate } from '@shared/middleware/auth.middleware';
import { requireRole, requireOwner } from '@shared/middleware/rbac.middleware';
import { auditLog } from '@shared/middleware/audit.middleware';
import { NotFoundError, ForbiddenError, BadRequestError } from '@shared/errors';
import { BedStatus, RoomRow, BedRow, UserRole } from '@shared/types';

// ─────────────────────────────────────────────
// Validators
// ─────────────────────────────────────────────

export const CreateRoomSchema = z.object({
  room_identifier_code: z.string().trim().min(1).max(30),
  floor_level_index: z.number().int().min(0).max(100).default(0),
  max_occupancy_sharing_limit: z.number().int().min(1).max(10),
  standard_monthly_rent_amount: z.number().positive().max(1000000),
  required_security_deposit_amount: z.number().min(0).max(5000000),
  room_type: z.enum(['AC', 'NON_AC', 'DELUXE', 'STANDARD', 'ECONOMY']).optional(),
  amenities: z.array(z.string()).default([]),
});

export const UpdateRoomSchema = CreateRoomSchema.partial();

export const CreateBedSchema = z.object({
  bed_spatial_code: z.string().trim().min(1).max(30),
});

export const CreateBedsSchema = z.object({
  beds: z.array(CreateBedSchema).min(1).max(20),
});

// ─────────────────────────────────────────────
// Room Repository
// ─────────────────────────────────────────────

async function findRoomById(id: string): Promise<RoomRow | null> {
  return queryOne<RoomRow>(`SELECT * FROM rooms WHERE id = $1`, [id]);
}

async function findRoomsByProperty(propertyId: string): Promise<(RoomRow & { vacant_beds: number; total_beds: number })[]> {
  return queryMany(
    `SELECT r.*,
            COUNT(b.id) FILTER (WHERE b.current_occupancy_status = 'VACANT') AS vacant_beds,
            COUNT(b.id) AS total_beds
     FROM rooms r
     LEFT JOIN beds b ON b.room_parent_id = r.id
     WHERE r.property_parent_id = $1 AND r.is_active = TRUE
     GROUP BY r.id
     ORDER BY r.floor_level_index ASC, r.room_identifier_code ASC`,
    [propertyId],
  );
}

async function getRoomWithBeds(roomId: string) {
  const [room, beds] = await Promise.all([
    findRoomById(roomId),
    queryMany<BedRow>(
      `SELECT * FROM beds WHERE room_parent_id = $1 ORDER BY bed_spatial_code ASC`,
      [roomId],
    ),
  ]);
  if (!room) return null;
  return { ...room, beds };
}

async function getPropertyOwner(propertyId: string): Promise<string | null> {
  const row = await queryOne<{ landlord_owner_id: string }>(
    `SELECT landlord_owner_id FROM properties WHERE id = $1 AND deleted_at IS NULL`,
    [propertyId],
  );
  return row?.landlord_owner_id ?? null;
}

async function createRoomInDb(propertyId: string, dto: z.infer<typeof CreateRoomSchema>): Promise<RoomRow> {
  const result = await queryOne<RoomRow>(
    `INSERT INTO rooms
       (property_parent_id, room_identifier_code, floor_level_index,
        max_occupancy_sharing_limit, standard_monthly_rent_amount,
        required_security_deposit_amount, room_type, amenities)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [
      propertyId, dto.room_identifier_code, dto.floor_level_index,
      dto.max_occupancy_sharing_limit, dto.standard_monthly_rent_amount,
      dto.required_security_deposit_amount, dto.room_type ?? null, dto.amenities,
    ],
  );
  if (!result) throw new Error('Failed to create room');
  return result;
}

async function updateRoomInDb(id: string, dto: z.infer<typeof UpdateRoomSchema>): Promise<RoomRow> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  const map: Record<string, string> = {
    room_identifier_code: 'room_identifier_code',
    floor_level_index: 'floor_level_index',
    max_occupancy_sharing_limit: 'max_occupancy_sharing_limit',
    standard_monthly_rent_amount: 'standard_monthly_rent_amount',
    required_security_deposit_amount: 'required_security_deposit_amount',
    room_type: 'room_type',
    amenities: 'amenities',
  };
  for (const [k, col] of Object.entries(map)) {
    if ((dto as Record<string, unknown>)[k] !== undefined) {
      sets.push(`${col} = $${i++}`);
      vals.push((dto as Record<string, unknown>)[k]);
    }
  }
  if (sets.length === 0) {
    const r = await findRoomById(id);
    if (!r) throw new NotFoundError('Room', id);
    return r;
  }
  vals.push(id);
  const result = await queryOne<RoomRow>(
    `UPDATE rooms SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING *`,
    vals,
  );
  if (!result) throw new NotFoundError('Room', id);
  return result;
}

async function softDeleteRoom(id: string): Promise<void> {
  await query(`UPDATE rooms SET is_active = FALSE, updated_at = NOW() WHERE id = $1`, [id]);
}

// ─────────────────────────────────────────────
// Ownership Guard helper
// ─────────────────────────────────────────────

async function assertOwnsProperty(propertyId: string, userId: string): Promise<void> {
  const ownerId = await getPropertyOwner(propertyId);
  if (!ownerId) throw new NotFoundError('Property', propertyId);
  if (ownerId !== userId) throw new ForbiddenError('You do not own this property');
}

async function assertOwnsRoom(roomId: string, userId: string): Promise<RoomRow> {
  const room = await findRoomById(roomId);
  if (!room) throw new NotFoundError('Room', roomId);
  await assertOwnsProperty(room.property_parent_id, userId);
  return room;
}

// ─────────────────────────────────────────────
// Room Controllers
// ─────────────────────────────────────────────

async function listRooms(req: Request, res: Response) {
  const rooms = await findRoomsByProperty(req.params.propertyId);
  sendSuccess(res, rooms);
}

async function getRoomWithBedsHandler(req: Request, res: Response) {
  const room = await getRoomWithBeds(req.params.roomId);
  if (!room) throw new NotFoundError('Room', req.params.roomId);
  sendSuccess(res, room);
}

async function createRoomHandler(req: Request, res: Response) {
  await assertOwnsProperty(req.params.propertyId, req.user!.id);
  const room = await createRoomInDb(req.params.propertyId, req.body);
  sendCreated(res, room, 'Room created');
}

async function updateRoomHandler(req: Request, res: Response) {
  await assertOwnsRoom(req.params.roomId, req.user!.id);
  const room = await updateRoomInDb(req.params.roomId, req.body);
  sendSuccess(res, room, 'Room updated');
}

async function deleteRoomHandler(req: Request, res: Response) {
  await assertOwnsRoom(req.params.roomId, req.user!.id);
  await softDeleteRoom(req.params.roomId);
  sendNoContent(res);
}

// ─────────────────────────────────────────────
// Router — mounted at /api/v1 (handles /rooms/* paths)
// ─────────────────────────────────────────────

export const roomRouter = Router();

// Public — list rooms for a property (shows vacancy without pricing sensitivity)
roomRouter.get('/:propertyId/rooms', listRooms);

// Room detail with all beds and live status (used by bed-selection screen)
roomRouter.get('/:propertyId/rooms/:roomId', getRoomWithBedsHandler);

// Owner / Admin — create, update, delete rooms
roomRouter.post(
  '/:propertyId/rooms',
  authenticate,
  requireRole(UserRole.OWNER, UserRole.SYSTEM_ADMIN),
  validateBody(CreateRoomSchema),
  auditLog('ROOM:CREATE'),
  createRoomHandler,
);

roomRouter.put(
  '/:propertyId/rooms/:roomId',
  authenticate,
  requireRole(UserRole.OWNER, UserRole.SYSTEM_ADMIN),
  validateBody(UpdateRoomSchema),
  auditLog('ROOM:UPDATE'),
  updateRoomHandler,
);

roomRouter.delete(
  '/:propertyId/rooms/:roomId',
  authenticate,
  requireRole(UserRole.OWNER, UserRole.SYSTEM_ADMIN),
  auditLog('ROOM:DELETE'),
  deleteRoomHandler,
);
