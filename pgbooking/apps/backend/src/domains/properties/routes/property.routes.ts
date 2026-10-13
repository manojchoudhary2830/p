import { Request, Response, Router } from 'express';
import multer from 'multer';
import * as propertyService from '../services/property.service';
import {
  CreatePropertySchema,
  UpdatePropertySchema,
  PropertySearchSchema,
  PropertyIdParamSchema,
  UploadPhotosSchema,
} from '../validators/property.validator';
import { sendSuccess, sendCreated, sendPaginated, sendNoContent } from '@shared/utils/response';
import { validateBody, validateQuery, validateParams } from '@shared/middleware/validation.middleware';
import { authenticate } from '@shared/middleware/auth.middleware';
import { requireOwner, requireOwnerOrAdmin } from '@shared/middleware/rbac.middleware';
import { uploadRateLimit, searchRateLimit } from '@shared/middleware/rate-limit.middleware';
import { auditLog } from '@shared/middleware/audit.middleware';
import { UserRole } from '@shared/types';
import { BadRequestError } from '@shared/errors';
import { env } from '@config/environment';

// ─────────────────────────────────────────────
// Multer (memory storage — buffer passed to S3)
// ─────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.UPLOAD_MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req: any, file: { mimetype: string }, cb: (error: Error | null, accept: boolean) => void) => {
    if (env.UPLOAD_ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new BadRequestError(`File type ${file.mimetype} is not allowed`), false as any);
    }
  },
});

// ─────────────────────────────────────────────
// Controllers
// ─────────────────────────────────────────────

async function createProperty(req: Request, res: Response) {
  const property = await propertyService.createProperty(req.user!.id, req.body);
  sendCreated(res, property, 'Property created. Pending admin verification.');
}

async function updateProperty(req: Request, res: Response) {
  const isAdmin = req.user!.role === UserRole.SYSTEM_ADMIN;
  const property = await propertyService.updateProperty(req.params.id, req.user!.id, req.body, isAdmin);
  sendSuccess(res, property, 'Property updated');
}

async function deleteProperty(req: Request, res: Response) {
  const isAdmin = req.user!.role === UserRole.SYSTEM_ADMIN;
  await propertyService.deleteProperty(req.params.id, req.user!.id, isAdmin);
  sendNoContent(res);
}

async function getPropertyById(req: Request, res: Response) {
  const property = await propertyService.getPropertyById(req.params.id, req.user?.id);
  sendSuccess(res, property);
}

async function searchProperties(req: Request, res: Response) {
  const result = await propertyService.searchProperties(req.query as never);
  sendPaginated(res, result);
}

async function getMyProperties(req: Request, res: Response) {
  const page = parseInt(req.query.page as string ?? '1', 10);
  const limit = parseInt(req.query.limit as string ?? '20', 10);
  const result = await propertyService.getOwnerProperties(req.user!.id, page, limit);
  sendPaginated(res, result);
}

async function uploadPhoto(req: Request, res: Response) {
  if (!req.file) throw new BadRequestError('No file uploaded');
  const { is_cover, caption, sort_order } = req.body;
  const photo = await propertyService.uploadPropertyPhoto({
    propertyId: req.params.id,
    ownerId: req.user!.id,
    buffer: req.file.buffer,
    originalName: req.file.originalname,
    contentType: req.file.mimetype,
    isCover: is_cover === 'true',
    caption,
    sortOrder: parseInt(sort_order ?? '0', 10),
  });
  sendCreated(res, photo, 'Photo uploaded');
}

async function deletePhoto(req: Request, res: Response) {
  await propertyService.deletePropertyPhoto(req.params.id, req.params.photoId, req.user!.id);
  sendNoContent(res);
}

async function toggleFavorite(req: Request, res: Response) {
  const result = await propertyService.toggleFavorite(req.user!.id, req.params.id);
  sendSuccess(res, result, result.added ? 'Added to favorites' : 'Removed from favorites');
}

async function getFavorites(req: Request, res: Response) {
  const favorites = await propertyService.getUserFavorites(req.user!.id);
  sendSuccess(res, favorites);
}

// ─────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────

export const propertyRouter = Router();

// Public / tenant routes
propertyRouter.get('/search', searchRateLimit, validateQuery(PropertySearchSchema), searchProperties);
propertyRouter.get('/favorites', authenticate, getFavorites);
propertyRouter.get('/:id', validateParams(PropertyIdParamSchema), getPropertyById);
propertyRouter.post('/:id/favorites', authenticate, validateParams(PropertyIdParamSchema), toggleFavorite);

// Owner routes
propertyRouter.get('/mine', authenticate, requireOwner, getMyProperties);
propertyRouter.post('/', authenticate, requireOwner, validateBody(CreatePropertySchema), auditLog('PROPERTY:CREATE'), createProperty);
propertyRouter.put('/:id', authenticate, requireOwnerOrAdmin, validateParams(PropertyIdParamSchema), validateBody(UpdatePropertySchema), auditLog('PROPERTY:UPDATE'), updateProperty);
propertyRouter.delete('/:id', authenticate, requireOwnerOrAdmin, validateParams(PropertyIdParamSchema), auditLog('PROPERTY:DELETE'), deleteProperty);
propertyRouter.post('/:id/photos', authenticate, requireOwner, uploadRateLimit, upload.single('photo'), uploadPhoto);
propertyRouter.delete('/:id/photos/:photoId', authenticate, requireOwner, deletePhoto);
