import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import { env } from '@config/environment';
import { logger } from '@shared/utils/logger';
import { ExternalServiceError } from '@shared/errors';

// ─────────────────────────────────────────────
// S3 Client
// ─────────────────────────────────────────────

export const s3Client = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
  ...(env.AWS_ENDPOINT_URL && {
    endpoint: env.AWS_ENDPOINT_URL,
    forcePathStyle: true, // required for LocalStack
  }),
});

// ─────────────────────────────────────────────
// Bucket Map
// ─────────────────────────────────────────────

export type BucketType = 'kyc' | 'properties' | 'maintenance';

const BUCKET_MAP: Record<BucketType, string> = {
  kyc: env.AWS_S3_BUCKET_KYC,
  properties: env.AWS_S3_BUCKET_PROPERTIES,
  maintenance: env.AWS_S3_BUCKET_MAINTENANCE,
};

// ─────────────────────────────────────────────
// Image Processing
// ─────────────────────────────────────────────

const IMAGE_VARIANTS = {
  thumbnail: { width: 200, height: 200, quality: 80 },
  medium: { width: 800, height: 600, quality: 85 },
  large: { width: 1920, height: 1080, quality: 90 },
} as const;

type ImageVariant = keyof typeof IMAGE_VARIANTS;

async function compressImage(
  buffer: Buffer,
  variant: ImageVariant = 'medium',
): Promise<{ buffer: Buffer; contentType: string }> {
  const config = IMAGE_VARIANTS[variant];
  const compressed = await sharp(buffer)
    .resize(config.width, config.height, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: config.quality })
    .toBuffer();

  return { buffer: compressed, contentType: 'image/webp' };
}

// ─────────────────────────────────────────────
// Upload Functions
// ─────────────────────────────────────────────

export interface UploadResult {
  key: string;
  bucket: string;
  url?: string;
  size: number;
  contentType: string;
  variants?: Record<ImageVariant, string>;
}

export async function uploadFile(params: {
  bucket: BucketType;
  buffer: Buffer;
  originalName: string;
  contentType: string;
  folder?: string;
  compress?: boolean;
  generateVariants?: boolean;
}): Promise<UploadResult> {
  const bucketName = BUCKET_MAP[params.bucket];
  const ext = params.contentType.startsWith('image/') ? 'webp' : path.extname(params.originalName).slice(1);
  const fileId = uuidv4();
  const folder = params.folder ?? 'uploads';
  const key = `${folder}/${fileId}.${ext}`;

  try {
    let uploadBuffer = params.buffer;
    let uploadContentType = params.contentType;

    // Compress images unless it's a PDF
    if (params.compress && params.contentType.startsWith('image/')) {
      const compressed = await compressImage(params.buffer, 'large');
      uploadBuffer = compressed.buffer;
      uploadContentType = compressed.contentType;
    }

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: uploadBuffer,
        ContentType: uploadContentType,
        Metadata: {
          originalName: encodeURIComponent(params.originalName),
          uploadedAt: new Date().toISOString(),
        },
        ServerSideEncryption: 'AES256',
      }),
    );

    const result: UploadResult = {
      key,
      bucket: bucketName,
      size: uploadBuffer.length,
      contentType: uploadContentType,
    };

    // Generate image variants for property photos
    if (params.generateVariants && params.contentType.startsWith('image/')) {
      const variants: Record<string, string> = {};
      for (const [variantName, config] of Object.entries(IMAGE_VARIANTS)) {
        const variantKey = `${folder}/${fileId}_${variantName}.webp`;
        const { buffer: variantBuffer } = await compressImage(
          params.buffer,
          variantName as ImageVariant,
        );

        await s3Client.send(
          new PutObjectCommand({
            Bucket: bucketName,
            Key: variantKey,
            Body: variantBuffer,
            ContentType: 'image/webp',
            ServerSideEncryption: 'AES256',
          }),
        );
        variants[variantName] = variantKey;
      }
      result.variants = variants as Record<ImageVariant, string>;
    }

    logger.info('File uploaded to S3', { bucket: bucketName, key, size: uploadBuffer.length });
    return result;
  } catch (error) {
    const err = error as Error;
    logger.error('S3 upload failed', { error: err.message, bucket: bucketName, key });
    throw new ExternalServiceError('S3', `Upload failed: ${err.message}`);
  }
}

// ─────────────────────────────────────────────
// Signed URL Generation
// ─────────────────────────────────────────────

export async function getSignedDownloadUrl(
  bucket: BucketType,
  key: string,
  expiresInSeconds = env.AWS_S3_SIGNED_URL_EXPIRY_SECONDS,
): Promise<string> {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_MAP[bucket],
      Key: key,
    });
    return await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
  } catch (error) {
    const err = error as Error;
    throw new ExternalServiceError('S3', `Failed to generate signed URL: ${err.message}`);
  }
}

export async function deleteFile(bucket: BucketType, key: string): Promise<void> {
  try {
    await s3Client.send(
      new DeleteObjectCommand({ Bucket: BUCKET_MAP[bucket], Key: key }),
    );
    logger.info('File deleted from S3', { bucket: BUCKET_MAP[bucket], key });
  } catch (error) {
    const err = error as Error;
    logger.error('S3 delete failed', { error: err.message });
    throw new ExternalServiceError('S3', `Delete failed: ${err.message}`);
  }
}

export async function fileExists(bucket: BucketType, key: string): Promise<boolean> {
  try {
    await s3Client.send(
      new HeadObjectCommand({ Bucket: BUCKET_MAP[bucket], Key: key }),
    );
    return true;
  } catch {
    return false;
  }
}
