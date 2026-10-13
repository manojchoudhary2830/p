/**
 * Search Router
 * Properties are searched via GET /api/v1/properties/search (PostGIS radius search).
 * This router is kept as a dedicated entry point for future search features:
 * - Full-text tenant/property search
 * - Autocomplete suggestions by city/area name
 * - Nearby landmark search
 *
 * Currently delegates to the properties search endpoint.
 */
import { Router } from 'express';
export const searchRouter = Router();
// Intentionally empty — search is handled by /api/v1/properties/search
// See: src/domains/properties/routes/property.routes.ts
