import { z } from 'zod';
import { GenderPolicy } from '@shared/types';

const ALLOWED_AMENITIES = [
  'HIGH_SPEED_WIFI', 'POWER_BACKUP', 'AIR_CONDITIONING', 'GEYSER',
  'MEALS', 'LAUNDRY', 'HOUSEKEEPING', 'PARKING', 'SECURITY', 'GYM',
  'TV', 'FRIDGE', 'WATER_PURIFIER', 'LIFT', 'CCTV', 'FIRE_SAFETY',
] as const;

export const CreatePropertySchema = z.object({
  property_display_name: z.string().trim().min(5).max(150),
  descriptive_summary: z.string().trim().max(2000).optional(),
  physical_address_line: z.string().trim().min(10).max(300),
  municipality_city: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100).default('Karnataka'),
  pincode: z.string().trim().regex(/^\d{6}$/, 'Pincode must be 6 digits').optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  gender_segregation_policy: z.nativeEnum(GenderPolicy),
  structural_amenities: z
    .array(z.enum(ALLOWED_AMENITIES))
    .max(ALLOWED_AMENITIES.length)
    .default([]),
  rules_and_policies: z.string().trim().max(2000).optional(),
  total_floors: z.number().int().min(0).max(100).optional(),
  established_year: z.number().int().min(1900).max(new Date().getFullYear()).optional(),
});

export const UpdatePropertySchema = CreatePropertySchema.partial();

export const PropertySearchSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius_km: z.coerce.number().min(0.5).max(50).default(5),
  gender_policy: z.nativeEnum(GenderPolicy).optional(),
  min_rent: z.coerce.number().min(0).optional(),
  max_rent: z.coerce.number().min(0).optional(),
  amenities: z
    .string()
    .transform((s: string) => s.split(',').map((a) => a.trim()).filter(Boolean))
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const PropertyIdParamSchema = z.object({
  id: z.string().uuid('Invalid property ID'),
});

export const UploadPhotosSchema = z.object({
  is_cover: z.coerce.boolean().default(false),
  caption: z.string().trim().max(200).optional(),
  sort_order: z.coerce.number().int().min(0).default(0),
});

export type CreatePropertyDto = z.infer<typeof CreatePropertySchema>;
export type UpdatePropertyDto = z.infer<typeof UpdatePropertySchema>;
export type PropertySearchDto = z.infer<typeof PropertySearchSchema>;
