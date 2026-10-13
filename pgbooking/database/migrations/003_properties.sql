-- Migration: 003_properties
-- Description: Property listings with PostGIS geometry and photo management

-- ─────────────────────────────────────────────
-- Table: properties
-- ─────────────────────────────────────────────
CREATE TABLE properties (
  id                              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  landlord_owner_id               UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  property_display_name           VARCHAR(150) NOT NULL,
  descriptive_summary             TEXT,
  physical_address_line           TEXT NOT NULL,
  municipality_city               VARCHAR(100) NOT NULL,
  state                           VARCHAR(100) NOT NULL DEFAULT 'Karnataka',
  pincode                         VARCHAR(10),
  geo_coordinate_point            GEOMETRY(Point, 4326) NOT NULL,
  gender_segregation_policy       gender_policy_enum NOT NULL,
  structural_amenities            TEXT[] NOT NULL DEFAULT '{}',
  rules_and_policies              TEXT,
  total_floors                    SMALLINT,
  established_year                SMALLINT,
  is_listing_verified_by_admin    BOOLEAN NOT NULL DEFAULT FALSE,
  verification_status             property_verification_status_enum NOT NULL DEFAULT 'PENDING',
  verification_notes              TEXT,
  verified_by_admin_id            UUID REFERENCES users(id) ON DELETE SET NULL,
  verified_at                     TIMESTAMPTZ,
  is_active                       BOOLEAN NOT NULL DEFAULT TRUE,

  -- Denormalized counters (updated via triggers) for fast listing queries
  total_beds                      SMALLINT NOT NULL DEFAULT 0,
  vacant_beds                     SMALLINT NOT NULL DEFAULT 0,
  min_rent                        NUMERIC(12,2),
  max_rent                        NUMERIC(12,2),

  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at                      TIMESTAMPTZ
);

CREATE TRIGGER properties_updated_at
  BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ─────────────────────────────────────────────
-- Indexes on properties
-- ─────────────────────────────────────────────

-- Primary geospatial index (GiST for ST_DWithin radius searches)
CREATE INDEX idx_properties_geo_gist
  ON properties USING GIST(geo_coordinate_point)
  WHERE deleted_at IS NULL AND is_active = TRUE;

CREATE INDEX idx_properties_owner
  ON properties(landlord_owner_id) WHERE deleted_at IS NULL;

CREATE INDEX idx_properties_city
  ON properties(municipality_city) WHERE deleted_at IS NULL AND is_active = TRUE;

CREATE INDEX idx_properties_gender_policy
  ON properties(gender_segregation_policy) WHERE deleted_at IS NULL;

CREATE INDEX idx_properties_verification
  ON properties(verification_status) WHERE deleted_at IS NULL;

CREATE INDEX idx_properties_vacant_beds
  ON properties(vacant_beds) WHERE deleted_at IS NULL AND is_active = TRUE;

CREATE INDEX idx_properties_rent_range
  ON properties(min_rent, max_rent) WHERE deleted_at IS NULL;

-- Text search on property name and city
CREATE INDEX idx_properties_name_trgm
  ON properties USING GIN(property_display_name gin_trgm_ops);

CREATE INDEX idx_properties_city_trgm
  ON properties USING GIN(municipality_city gin_trgm_ops);

-- Composite for common owner dashboard query
CREATE INDEX idx_properties_owner_status
  ON properties(landlord_owner_id, verification_status) WHERE deleted_at IS NULL;

COMMENT ON TABLE properties IS 'PG / co-living property listings with PostGIS coordinates.';
COMMENT ON COLUMN properties.geo_coordinate_point IS 'PostGIS POINT(longitude latitude) in WGS84 (SRID 4326).';
COMMENT ON COLUMN properties.total_beds IS 'Denormalized. Updated by trigger when beds are created/deleted.';
COMMENT ON COLUMN properties.vacant_beds IS 'Denormalized. Updated by trigger when bed status changes.';

-- ─────────────────────────────────────────────
-- Table: property_photos
-- ─────────────────────────────────────────────
CREATE TABLE property_photos (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id   UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  s3_key        VARCHAR(500) NOT NULL,
  thumbnail_key VARCHAR(500),
  medium_key    VARCHAR(500),
  caption       VARCHAR(200),
  sort_order    SMALLINT NOT NULL DEFAULT 0,
  is_cover      BOOLEAN NOT NULL DEFAULT FALSE,
  uploaded_by   UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enforce only one cover photo per property
CREATE UNIQUE INDEX idx_property_photos_cover
  ON property_photos(property_id)
  WHERE is_cover = TRUE;

CREATE INDEX idx_property_photos_property
  ON property_photos(property_id, sort_order);

COMMENT ON TABLE property_photos IS 'S3-backed property photos with multiple image variants.';

-- NOTE: update_property_bed_counters() is defined in migration 004
-- (after the beds table exists) because it references the beds table.
