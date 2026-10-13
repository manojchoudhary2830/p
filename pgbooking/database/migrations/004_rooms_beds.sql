-- Migration: 004_rooms_beds
-- Description: Room and bed inventory with cascade triggers for property counters

-- ─────────────────────────────────────────────
-- Table: rooms
-- ─────────────────────────────────────────────
CREATE TABLE rooms (
  id                                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_parent_id                UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  room_identifier_code              VARCHAR(30) NOT NULL,
  floor_level_index                 SMALLINT NOT NULL DEFAULT 0,
  max_occupancy_sharing_limit       SMALLINT NOT NULL CHECK (max_occupancy_sharing_limit BETWEEN 1 AND 10),
  standard_monthly_rent_amount      NUMERIC(12,2) NOT NULL CHECK (standard_monthly_rent_amount > 0),
  required_security_deposit_amount  NUMERIC(12,2) NOT NULL CHECK (required_security_deposit_amount >= 0),
  token_deposit_amount              NUMERIC(12,2) GENERATED ALWAYS AS (required_security_deposit_amount * 0.20) STORED,
  room_type                         VARCHAR(50),  -- e.g. 'AC', 'NON_AC', 'DELUXE'
  amenities                         TEXT[] NOT NULL DEFAULT '{}',
  is_active                         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_room_code_per_property UNIQUE (property_parent_id, room_identifier_code)
);

CREATE TRIGGER rooms_updated_at
  BEFORE UPDATE ON rooms
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Update property rent range when room rent changes
CREATE OR REPLACE FUNCTION trigger_update_property_on_room_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM update_property_bed_counters(OLD.property_parent_id);
  ELSE
    PERFORM update_property_bed_counters(NEW.property_parent_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rooms_property_counter_sync
  AFTER INSERT OR UPDATE OF standard_monthly_rent_amount OR DELETE ON rooms
  FOR EACH ROW EXECUTE FUNCTION trigger_update_property_on_room_change();

CREATE INDEX idx_rooms_property       ON rooms(property_parent_id) WHERE is_active = TRUE;
CREATE INDEX idx_rooms_floor          ON rooms(property_parent_id, floor_level_index);
CREATE INDEX idx_rooms_rent           ON rooms(standard_monthly_rent_amount);
CREATE INDEX idx_rooms_sharing        ON rooms(max_occupancy_sharing_limit);

COMMENT ON TABLE rooms IS 'Individual rooms within a property. Token deposit = 20% of security deposit (computed column).';
COMMENT ON COLUMN rooms.token_deposit_amount IS 'Auto-computed: 20% of required_security_deposit_amount per PRD spec.';

-- ─────────────────────────────────────────────
-- Table: beds
-- ─────────────────────────────────────────────
CREATE TABLE beds (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_parent_id            UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  bed_spatial_code          VARCHAR(30) NOT NULL,
  current_occupancy_status  bed_status_enum NOT NULL DEFAULT 'VACANT',
  last_modified_timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_bed_code_per_room UNIQUE (room_parent_id, bed_spatial_code)
);

-- ─────────────────────────────────────────────
-- Function: update_property_bed_counters
-- Defined here (not in 003) because it references the beds table.
-- Called by triggers on both beds and rooms tables.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_property_bed_counters(property_id_arg UUID)
RETURNS VOID AS $$
  UPDATE properties p
  SET
    total_beds  = (SELECT COUNT(*) FROM beds b JOIN rooms r ON r.id = b.room_parent_id WHERE r.property_parent_id = p.id),
    vacant_beds = (SELECT COUNT(*) FROM beds b JOIN rooms r ON r.id = b.room_parent_id WHERE r.property_parent_id = p.id AND b.current_occupancy_status = 'VACANT'),
    min_rent    = (SELECT MIN(r2.standard_monthly_rent_amount) FROM rooms r2 WHERE r2.property_parent_id = p.id),
    max_rent    = (SELECT MAX(r2.standard_monthly_rent_amount) FROM rooms r2 WHERE r2.property_parent_id = p.id),
    updated_at  = NOW()
  WHERE p.id = property_id_arg;
$$ LANGUAGE sql;

-- ─────────────────────────────────────────────
-- Trigger: Sync property bed counters when bed status changes
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_sync_property_bed_counters()
RETURNS TRIGGER AS $$
DECLARE
  v_property_id UUID;
BEGIN
  -- Get the property ID via the room
  SELECT r.property_parent_id INTO v_property_id
  FROM rooms r
  WHERE r.id = COALESCE(NEW.room_parent_id, OLD.room_parent_id);

  -- Update timestamps
  IF TG_OP = 'UPDATE' THEN
    NEW.last_modified_timestamp = NOW();
  END IF;

  PERFORM update_property_bed_counters(v_property_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER beds_sync_property_counters
  AFTER INSERT OR UPDATE OF current_occupancy_status OR DELETE ON beds
  FOR EACH ROW EXECUTE FUNCTION trigger_sync_property_bed_counters();

-- ─────────────────────────────────────────────
-- Indexes on beds
-- ─────────────────────────────────────────────

-- Operational lookup: find vacant beds in a room
CREATE INDEX idx_beds_room_status
  ON beds(room_parent_id, current_occupancy_status);

-- For booking engine: find a specific bed status quickly
CREATE INDEX idx_beds_status
  ON beds(current_occupancy_status);

-- For joining to get property info quickly
CREATE INDEX idx_beds_room
  ON beds(room_parent_id);

COMMENT ON TABLE beds IS 'Individual bed inventory units. Status changes trigger property counter updates.';

-- ─────────────────────────────────────────────
-- View: available_beds_with_room_details
-- Used by search and booking engine
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW available_beds_with_room_details AS
SELECT
  b.id                                  AS bed_id,
  b.bed_spatial_code,
  b.current_occupancy_status,
  r.id                                  AS room_id,
  r.room_identifier_code,
  r.floor_level_index,
  r.max_occupancy_sharing_limit,
  r.standard_monthly_rent_amount        AS monthly_rent,
  r.required_security_deposit_amount    AS security_deposit,
  r.token_deposit_amount,
  r.room_type,
  r.amenities                           AS room_amenities,
  p.id                                  AS property_id,
  p.property_display_name,
  p.municipality_city,
  p.gender_segregation_policy,
  p.structural_amenities,
  ST_Y(p.geo_coordinate_point::geometry) AS latitude,
  ST_X(p.geo_coordinate_point::geometry) AS longitude
FROM beds b
JOIN rooms r ON r.id = b.room_parent_id AND r.is_active = TRUE
JOIN properties p ON p.id = r.property_parent_id
  AND p.is_active = TRUE
  AND p.deleted_at IS NULL
  AND p.verification_status = 'VERIFIED'
WHERE b.current_occupancy_status = 'VACANT';

COMMENT ON VIEW available_beds_with_room_details IS 'Denormalized view of all vacant beds with full room and property context. Used by booking engine and search.';
