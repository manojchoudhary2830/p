import { getCacheClient } from '@config/redis';
import { env } from '@config/environment';
import { uploadFile, getSignedDownloadUrl, deleteFile } from '@infrastructure/storage/s3.client';
import { NotFoundError, ForbiddenError, BadRequestError } from '@shared/errors';
import { buildPaginatedResult, parsePaginationParams } from '@shared/utils/response';
import { logger } from '@shared/utils/logger';
import * as propertyRepo from '../repositories/property.repository';
import { CreatePropertyDto, UpdatePropertyDto, PropertySearchDto } from '../validators/property.validator';

const CACHE_TTL_PROPERTY = 300;      // 5 minutes
const CACHE_TTL_SEARCH   = 60;       // 1 minute

function cacheKey(type: string, id: string) {
  return `${env.REDIS_KEY_PREFIX}prop:${type}:${id}`;
}

// ─────────────────────────────────────────────
// Read
// ─────────────────────────────────────────────

export async function getPropertyById(id: string, requestingUserId?: string) {
  const cache = getCacheClient();
  const cached = await cache.get(cacheKey('detail', id));
  if (cached) return JSON.parse(cached);

  const property = await propertyRepo.findPropertyById(id);
  if (!property) throw new NotFoundError('Property', id);

  const photos = await propertyRepo.getPropertyPhotos(id);

  // Sign cover photo URL
  const enrichedPhotos = await Promise.all(
    photos.map(async (p: { s3_key: string; thumbnail_key: string | null; medium_key: string | null; [key: string]: unknown }) => ({
      ...p,
      url: await getSignedDownloadUrl('properties', p.s3_key),
      thumbnail_url: p.thumbnail_key
        ? await getSignedDownloadUrl('properties', p.thumbnail_key)
        : null,
      medium_url: p.medium_key
        ? await getSignedDownloadUrl('properties', p.medium_key)
        : null,
    })),
  );

  const result = { ...property, photos: enrichedPhotos };
  await cache.setex(cacheKey('detail', id), CACHE_TTL_PROPERTY, JSON.stringify(result));
  return result;
}

export async function searchProperties(dto: PropertySearchDto) {
  const offset = (dto.page - 1) * dto.limit;
  const cKey = cacheKey('search', `${dto.lat}:${dto.lng}:${dto.radius_km}:${dto.gender_policy}:${dto.min_rent}:${dto.max_rent}:${dto.page}:${dto.limit}`);

  const cache = getCacheClient();
  const cached = await cache.get(cKey);
  if (cached) return JSON.parse(cached);

  const { rows, total } = await propertyRepo.searchByRadius({
    lat: dto.lat,
    lng: dto.lng,
    radiusKm: dto.radius_km,
    genderPolicy: dto.gender_policy,
    minRent: dto.min_rent,
    maxRent: dto.max_rent,
    amenities: dto.amenities,
    limit: dto.limit,
    offset,
  });

  // Sign cover photos in parallel
  const enriched = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      cover_photo_url: row.cover_photo_key
        ? await getSignedDownloadUrl('properties', row.cover_photo_key).catch(() => null)
        : null,
    })),
  );

  const result = buildPaginatedResult(enriched, total, { page: dto.page, limit: dto.limit });
  await cache.setex(cKey, CACHE_TTL_SEARCH, JSON.stringify(result));
  return result;
}

export async function getOwnerProperties(ownerId: string, page: number, limit: number) {
  const { rows, total } = await propertyRepo.findPropertiesByOwner(ownerId, { page, limit });
  return buildPaginatedResult(rows, total, { page, limit });
}

// ─────────────────────────────────────────────
// Write
// ─────────────────────────────────────────────

export async function createProperty(ownerId: string, dto: CreatePropertyDto) {
  const property = await propertyRepo.createProperty(ownerId, dto);
  logger.info('Property created', { propertyId: property.id, ownerId });
  return property;
}

export async function updateProperty(
  id: string,
  ownerId: string,
  dto: UpdatePropertyDto,
  isAdmin = false,
) {
  const property = await propertyRepo.findPropertyById(id);
  if (!property) throw new NotFoundError('Property', id);
  if (!isAdmin && property.landlord_owner_id !== ownerId) throw new ForbiddenError();

  const updated = await propertyRepo.updateProperty(id, dto);

  // Bust cache
  const cache = getCacheClient();
  await cache.del(cacheKey('detail', id));
  await cache.del(cacheKey('search', '*'));

  return updated;
}

export async function deleteProperty(id: string, ownerId: string, isAdmin = false) {
  const property = await propertyRepo.findPropertyById(id);
  if (!property) throw new NotFoundError('Property', id);
  if (!isAdmin && property.landlord_owner_id !== ownerId) throw new ForbiddenError();

  await propertyRepo.softDeleteProperty(id);
  await getCacheClient().del(cacheKey('detail', id));
  logger.info('Property soft-deleted', { propertyId: id, byUser: ownerId });
}

// ─────────────────────────────────────────────
// Photos
// ─────────────────────────────────────────────

export async function uploadPropertyPhoto(params: {
  propertyId: string;
  ownerId: string;
  buffer: Buffer;
  originalName: string;
  contentType: string;
  isCover: boolean;
  caption?: string;
  sortOrder: number;
}) {
  const property = await propertyRepo.findPropertyById(params.propertyId);
  if (!property) throw new NotFoundError('Property', params.propertyId);
  if (property.landlord_owner_id !== params.ownerId) throw new ForbiddenError();

  const upload = await uploadFile({
    bucket: 'properties',
    buffer: params.buffer,
    originalName: params.originalName,
    contentType: params.contentType,
    folder: `properties/${params.propertyId}`,
    compress: true,
    generateVariants: true,
  });

  const photo = await propertyRepo.addPropertyPhoto({
    propertyId: params.propertyId,
    s3Key: upload.key,
    thumbnailKey: upload.variants?.thumbnail,
    mediumKey: upload.variants?.medium,
    caption: params.caption,
    sortOrder: params.sortOrder,
    isCover: params.isCover,
    uploadedBy: params.ownerId,
  });

  await getCacheClient().del(cacheKey('detail', params.propertyId));
  return photo;
}

export async function deletePropertyPhoto(
  propertyId: string,
  photoId: string,
  ownerId: string,
) {
  const property = await propertyRepo.findPropertyById(propertyId);
  if (!property) throw new NotFoundError('Property', propertyId);
  if (property.landlord_owner_id !== ownerId) throw new ForbiddenError();

  const s3Key = await propertyRepo.deletePropertyPhoto(photoId, propertyId);
  if (!s3Key) throw new NotFoundError('Photo', photoId);

  await deleteFile('properties', s3Key).catch((e: Error) =>
    logger.warn('S3 photo delete failed', { error: e.message, key: s3Key }),
  );

  await getCacheClient().del(cacheKey('detail', propertyId));
}

// ─────────────────────────────────────────────
// Favorites
// ─────────────────────────────────────────────

export async function toggleFavorite(userId: string, propertyId: string) {
  const property = await propertyRepo.findPropertyById(propertyId);
  if (!property) throw new NotFoundError('Property', propertyId);
  return propertyRepo.toggleFavorite(userId, propertyId);
}

export async function getUserFavorites(userId: string) {
  const rows = await propertyRepo.getUserFavorites(userId);
  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      cover_photo_url: row.cover_photo_key
        ? await getSignedDownloadUrl('properties', row.cover_photo_key).catch(() => null)
        : null,
    })),
  );
}
