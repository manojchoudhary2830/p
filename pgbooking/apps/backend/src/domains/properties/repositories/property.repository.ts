import { PoolClient } from 'pg';
import { query, queryOne, queryMany, withTransaction } from '@config/database';
import { PropertyRow, PaginationParams } from '@shared/types';
import { CreatePropertyDto, UpdatePropertyDto } from '../validators/property.validator';

// ─────────────────────────────────────────────
// Read
// ─────────────────────────────────────────────

export async function findPropertyById(id: string): Promise<PropertyRow | null> {
  return queryOne<PropertyRow>(
    `SELECT p.*,
            ST_Y(p.geo_coordinate_point::geometry) AS latitude,
            ST_X(p.geo_coordinate_point::geometry) AS longitude
     FROM properties p
     WHERE p.id = $1 AND p.deleted_at IS NULL`,
    [id],
  );
}

export async function findPropertyByIdAndOwner(
  id: string,
  ownerId: string,
): Promise<PropertyRow | null> {
  return queryOne<PropertyRow>(
    `SELECT p.*,
            ST_Y(p.geo_coordinate_point::geometry) AS latitude,
            ST_X(p.geo_coordinate_point::geometry) AS longitude
     FROM properties p
     WHERE p.id = $1 AND p.landlord_owner_id = $2 AND p.deleted_at IS NULL`,
    [id, ownerId],
  );
}

export async function findPropertiesByOwner(
  ownerId: string,
  pagination: PaginationParams,
): Promise<{ rows: PropertyRow[]; total: number }> {
  const offset = (pagination.page - 1) * pagination.limit;
  const [rows, countResult] = await Promise.all([
    queryMany<PropertyRow>(
      `SELECT p.*,
              ST_Y(p.geo_coordinate_point::geometry) AS latitude,
              ST_X(p.geo_coordinate_point::geometry) AS longitude,
              (SELECT COUNT(*) FROM property_photos pp WHERE pp.property_id = p.id) AS photo_count
       FROM properties p
       WHERE p.landlord_owner_id = $1 AND p.deleted_at IS NULL
       ORDER BY p.created_at DESC
       LIMIT $2 OFFSET $3`,
      [ownerId, pagination.limit, offset],
    ),
    queryOne<{ count: string }>(
      `SELECT COUNT(*) FROM properties WHERE landlord_owner_id = $1 AND deleted_at IS NULL`,
      [ownerId],
    ),
  ]);
  return { rows, total: parseInt(countResult?.count ?? '0', 10) };
}

export interface RadiusSearchResult extends PropertyRow {
  distance_km: number;
  cover_photo_key: string | null;
  avg_rating: number | null;
  total_reviews: number;
  latitude: number;
  longitude: number;
}

export async function searchByRadius(params: {
  lat: number;
  lng: number;
  radiusKm: number;
  genderPolicy?: string;
  minRent?: number;
  maxRent?: number;
  amenities?: string[];
  limit: number;
  offset: number;
}): Promise<{ rows: RadiusSearchResult[]; total: number }> {
  const rows = await queryMany<RadiusSearchResult>(
    `SELECT * FROM search_properties_in_radius($1, $2, $3, $4::gender_policy_enum, $5, $6, $7, $8, $9)`,
    [
      params.lat,
      params.lng,
      params.radiusKm,
      params.genderPolicy ?? null,
      params.minRent ?? null,
      params.maxRent ?? null,
      params.amenities?.length ? params.amenities : null,
      params.limit,
      params.offset,
    ],
  );

  // Count total matching (for pagination metadata)
  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) FROM properties p
     WHERE p.deleted_at IS NULL AND p.is_active = TRUE
       AND p.verification_status = 'VERIFIED' AND p.vacant_beds > 0
       AND ST_DWithin(p.geo_coordinate_point::geography,
             ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, $3 * 1000)
       AND ($4::gender_policy_enum IS NULL OR p.gender_segregation_policy = $4::gender_policy_enum)
       AND ($5::numeric IS NULL OR p.min_rent >= $5)
       AND ($6::numeric IS NULL OR p.max_rent <= $6)`,
    [params.lat, params.lng, params.radiusKm, params.genderPolicy ?? null, params.minRent ?? null, params.maxRent ?? null],
  );

  return { rows, total: parseInt(countResult?.count ?? '0', 10) };
}

export async function getPropertyPhotos(propertyId: string) {
  return queryMany(
    `SELECT id, s3_key, thumbnail_key, medium_key, caption, sort_order, is_cover
     FROM property_photos
     WHERE property_id = $1
     ORDER BY is_cover DESC, sort_order ASC`,
    [propertyId],
  );
}

// ─────────────────────────────────────────────
// Write
// ─────────────────────────────────────────────

export async function createProperty(
  ownerId: string,
  dto: CreatePropertyDto,
): Promise<PropertyRow> {
  const result = await queryOne<PropertyRow>(
    `INSERT INTO properties (
       landlord_owner_id, property_display_name, descriptive_summary,
       physical_address_line, municipality_city, state, pincode,
       geo_coordinate_point, gender_segregation_policy,
       structural_amenities, rules_and_policies, total_floors, established_year
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7,
       ST_SetSRID(ST_MakePoint($9, $8), 4326),
       $10, $11, $12, $13, $14
     )
     RETURNING *,
       ST_Y(geo_coordinate_point::geometry) AS latitude,
       ST_X(geo_coordinate_point::geometry) AS longitude`,
    [
      ownerId,
      dto.property_display_name,
      dto.descriptive_summary ?? null,
      dto.physical_address_line,
      dto.municipality_city,
      dto.state,
      dto.pincode ?? null,
      dto.latitude,
      dto.longitude,
      dto.gender_segregation_policy,
      dto.structural_amenities,
      dto.rules_and_policies ?? null,
      dto.total_floors ?? null,
      dto.established_year ?? null,
    ],
  );
  if (!result) throw new Error('Failed to create property');
  return result;
}

export async function updateProperty(
  id: string,
  dto: Partial<CreatePropertyDto>,
): Promise<PropertyRow> {
  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  const fieldMap: Record<string, string> = {
    property_display_name: 'property_display_name',
    descriptive_summary: 'descriptive_summary',
    physical_address_line: 'physical_address_line',
    municipality_city: 'municipality_city',
    state: 'state',
    pincode: 'pincode',
    gender_segregation_policy: 'gender_segregation_policy',
    structural_amenities: 'structural_amenities',
    rules_and_policies: 'rules_and_policies',
    total_floors: 'total_floors',
    established_year: 'established_year',
  };

  for (const [key, col] of Object.entries(fieldMap)) {
    const val = (dto as Record<string, unknown>)[key];
    if (val !== undefined) {
      sets.push(`${col} = $${idx++}`);
      values.push(val);
    }
  }

  if (dto.latitude !== undefined && dto.longitude !== undefined) {
    sets.push(`geo_coordinate_point = ST_SetSRID(ST_MakePoint($${idx++}, $${idx++}), 4326)`);
    values.push(dto.longitude, dto.latitude);
  }

  if (sets.length === 0) {
    const existing = await findPropertyById(id);
    if (!existing) throw new Error('Property not found');
    return existing;
  }

  values.push(id);
  const result = await queryOne<PropertyRow>(
    `UPDATE properties SET ${sets.join(', ')}, updated_at = NOW()
     WHERE id = $${idx} AND deleted_at IS NULL
     RETURNING *,
       ST_Y(geo_coordinate_point::geometry) AS latitude,
       ST_X(geo_coordinate_point::geometry) AS longitude`,
    values,
  );
  if (!result) throw new Error('Property not found');
  return result;
}

export async function softDeleteProperty(id: string): Promise<void> {
  await query(
    `UPDATE properties SET deleted_at = NOW(), is_active = FALSE WHERE id = $1`,
    [id],
  );
}

export async function addPropertyPhoto(params: {
  propertyId: string;
  s3Key: string;
  thumbnailKey?: string;
  mediumKey?: string;
  caption?: string;
  sortOrder: number;
  isCover: boolean;
  uploadedBy: string;
}): Promise<{ id: string }> {
  if (params.isCover) {
    await query(
      `UPDATE property_photos SET is_cover = FALSE WHERE property_id = $1`,
      [params.propertyId],
    );
  }
  const result = await queryOne<{ id: string }>(
    `INSERT INTO property_photos
       (property_id, s3_key, thumbnail_key, medium_key, caption, sort_order, is_cover, uploaded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id`,
    [
      params.propertyId,
      params.s3Key,
      params.thumbnailKey ?? null,
      params.mediumKey ?? null,
      params.caption ?? null,
      params.sortOrder,
      params.isCover,
      params.uploadedBy,
    ],
  );
  if (!result) throw new Error('Failed to add photo');
  return result;
}

export async function deletePropertyPhoto(photoId: string, propertyId: string): Promise<string | null> {
  const row = await queryOne<{ s3_key: string }>(
    `DELETE FROM property_photos WHERE id = $1 AND property_id = $2 RETURNING s3_key`,
    [photoId, propertyId],
  );
  return row?.s3_key ?? null;
}

export async function toggleFavorite(
  userId: string,
  propertyId: string,
): Promise<{ added: boolean }> {
  const existing = await queryOne(
    `SELECT id FROM favorites WHERE user_id = $1 AND property_id = $2`,
    [userId, propertyId],
  );
  if (existing) {
    await query(`DELETE FROM favorites WHERE user_id = $1 AND property_id = $2`, [userId, propertyId]);
    return { added: false };
  }
  await query(`INSERT INTO favorites (user_id, property_id) VALUES ($1, $2)`, [userId, propertyId]);
  return { added: true };
}

export async function getUserFavorites(userId: string): Promise<RadiusSearchResult[]> {
  return queryMany<RadiusSearchResult>(
    `SELECT p.*,
            0 AS distance_km,
            ST_Y(p.geo_coordinate_point::geometry) AS latitude,
            ST_X(p.geo_coordinate_point::geometry) AS longitude,
            ph.s3_key AS cover_photo_key,
            rs.avg_rating, rs.total_reviews
     FROM favorites f
     JOIN properties p ON p.id = f.property_id AND p.deleted_at IS NULL
     LEFT JOIN property_photos ph ON ph.property_id = p.id AND ph.is_cover = TRUE
     LEFT JOIN property_rating_summary rs ON rs.property_id = p.id
     WHERE f.user_id = $1
     ORDER BY f.created_at DESC`,
    [userId],
  );
}
