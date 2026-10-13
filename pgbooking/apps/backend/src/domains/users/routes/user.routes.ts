import { Request, Response, Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { query, queryOne, queryMany } from '@config/database';
import { uploadFile, getSignedDownloadUrl, deleteFile } from '@infrastructure/storage/s3.client';
import { encryptSensitiveData } from '@shared/utils/crypto';
import { sendSuccess, sendCreated, sendNoContent } from '@shared/utils/response';
import { validateBody } from '@shared/middleware/validation.middleware';
import { authenticate } from '@shared/middleware/auth.middleware';
import { uploadRateLimit } from '@shared/middleware/rate-limit.middleware';
import { auditLog } from '@shared/middleware/audit.middleware';
import { NotFoundError, BadRequestError, ForbiddenError } from '@shared/errors';
import { env } from '@config/environment';
import { KycDocumentType } from '@shared/types';

// ─────────────────────────────────────────────
// Validators
// ─────────────────────────────────────────────

const UploadKycSchema = z.object({
  document_type: z.nativeEnum(KycDocumentType),
  document_number: z.string().trim().max(50).optional(),
});

// ─────────────────────────────────────────────
// Multer (profile photos + KYC docs)
// ─────────────────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.UPLOAD_MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req: any, file: { mimetype: string }, cb: (error: Error | null, accept: boolean) => void) => {
    if (env.UPLOAD_ALLOWED_MIME_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new BadRequestError(`File type ${file.mimetype} is not allowed`), false as any);
  },
});

// ─────────────────────────────────────────────
// Profile Photo
// ─────────────────────────────────────────────

async function uploadProfilePhoto(req: Request, res: Response): Promise<void> {
  if (!req.file) throw new BadRequestError('No file uploaded');
  const userId = req.user!.id;

  const result = await uploadFile({
    bucket: 'properties',
    buffer: req.file.buffer,
    originalName: req.file.originalname,
    contentType: req.file.mimetype,
    folder: `profile-photos/${userId}`,
    compress: true,
  });

  await query(
    `UPDATE users SET profile_photo_key = $1, record_updated_at = NOW() WHERE id = $2`,
    [result.key, userId],
  );

  const url = await getSignedDownloadUrl('properties', result.key);
  sendSuccess(res, { profile_photo_url: url }, 'Profile photo updated');
}

async function getProfilePhoto(req: Request, res: Response): Promise<void> {
  const user = await queryOne<{ profile_photo_key: string | null }>(
    `SELECT profile_photo_key FROM users WHERE id = $1`,
    [req.user!.id],
  );
  if (!user?.profile_photo_key) {
    sendSuccess(res, { profile_photo_url: null });
    return;
  }
  const url = await getSignedDownloadUrl('properties', user.profile_photo_key);
  sendSuccess(res, { profile_photo_url: url });
}

// ─────────────────────────────────────────────
// KYC Documents
// ─────────────────────────────────────────────

async function uploadKycDocument(req: Request, res: Response): Promise<void> {
  if (!req.file) throw new BadRequestError('No document file uploaded');
  const { document_type, document_number } = req.body as z.infer<typeof UploadKycSchema>;
  const userId = req.user!.id;

  const result = await uploadFile({
    bucket: 'kyc',
    buffer: req.file.buffer,
    originalName: req.file.originalname,
    contentType: req.file.mimetype,
    folder: `kyc/${userId}`,
    compress: req.file.mimetype.startsWith('image/'),
  });

  const encryptedNumber = document_number ? encryptSensitiveData(document_number) : null;

  const doc = await queryOne(
    `INSERT INTO kyc_documents (user_id, document_type, s3_key, document_number, verification_status)
     VALUES ($1, $2, $3, $4, 'PENDING_REVIEW')
     RETURNING id, document_type, verification_status, created_at`,
    [userId, document_type, result.key, encryptedNumber],
  );

  await query(
    `UPDATE users SET identity_kyc_status = 'PENDING_REVIEW', record_updated_at = NOW()
     WHERE id = $1 AND identity_kyc_status = 'UNVERIFIED'`,
    [userId],
  );

  sendCreated(res, doc, 'KYC document submitted for review');
}

async function getMyKycDocuments(req: Request, res: Response): Promise<void> {
  const docs = await queryMany(
    `SELECT id, document_type, verification_status, rejection_reason, created_at, reviewed_at
     FROM kyc_documents WHERE user_id = $1 ORDER BY created_at DESC`,
    [req.user!.id],
  );
  sendSuccess(res, docs);
}

async function deleteKycDocument(req: Request, res: Response): Promise<void> {
  const doc = await queryOne<{ s3_key: string; verification_status: string }>(
    `SELECT s3_key, verification_status FROM kyc_documents WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.user!.id],
  );
  if (!doc) throw new NotFoundError('KYC Document', req.params.id);
  if (doc.verification_status === 'VERIFIED') {
    throw new ForbiddenError('Cannot delete a verified document');
  }

  await query(`DELETE FROM kyc_documents WHERE id = $1`, [req.params.id]);
  await deleteFile('kyc', doc.s3_key).catch(() => {});
  sendNoContent(res);
}

// ─────────────────────────────────────────────
// Search users by name/phone (used by owner/admin UIs)
// ─────────────────────────────────────────────

async function searchUsersByName(req: Request, res: Response): Promise<void> {
  const q = (req.query.q as string ?? '').trim();
  if (q.length < 2) {
    sendSuccess(res, []);
    return;
  }
  const results = await queryMany(
    `SELECT id, legal_full_name, phone_number, account_role, identity_kyc_status
     FROM users
     WHERE deleted_at IS NULL
       AND (legal_full_name ILIKE $1 OR phone_number ILIKE $1)
     ORDER BY legal_full_name ASC
     LIMIT 20`,
    [`%${q}%`],
  );
  sendSuccess(res, results);
}

// ─────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────

export const userRouter = Router();

userRouter.post('/profile-photo', authenticate, uploadRateLimit, upload.single('photo'), auditLog('USER:PROFILE_PHOTO_UPLOAD'), uploadProfilePhoto);
userRouter.get('/profile-photo', authenticate, getProfilePhoto);

userRouter.post(
  '/kyc-documents',
  authenticate,
  uploadRateLimit,
  upload.single('document'),
  validateBody(UploadKycSchema),
  auditLog('USER:KYC_UPLOAD'),
  uploadKycDocument,
);
userRouter.get('/kyc-documents', authenticate, getMyKycDocuments);
userRouter.delete('/kyc-documents/:id', authenticate, auditLog('USER:KYC_DELETE'), deleteKycDocument);

userRouter.get('/search', authenticate, searchUsersByName);
