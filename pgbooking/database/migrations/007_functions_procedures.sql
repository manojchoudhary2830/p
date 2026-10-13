-- Migration: 007_functions_procedures
-- Description: Stored procedures for booking engine, rent invoicing, and geospatial search

-- ─────────────────────────────────────────────
-- Function: Search properties within radius
-- Returns properties with distance, sorted by proximity
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION search_properties_in_radius(
  p_lat           FLOAT8,
  p_lng           FLOAT8,
  p_radius_km     FLOAT8 DEFAULT 5.0,
  p_gender_policy gender_policy_enum DEFAULT NULL,
  p_min_rent      NUMERIC DEFAULT NULL,
  p_max_rent      NUMERIC DEFAULT NULL,
  p_amenities     TEXT[] DEFAULT NULL,
  p_limit         INT DEFAULT 20,
  p_offset        INT DEFAULT 0
)
RETURNS TABLE (
  id                    UUID,
  property_display_name VARCHAR,
  municipality_city     VARCHAR,
  gender_segregation_policy gender_policy_enum,
  structural_amenities  TEXT[],
  total_beds            SMALLINT,
  vacant_beds           SMALLINT,
  min_rent              NUMERIC,
  max_rent              NUMERIC,
  latitude              FLOAT8,
  longitude             FLOAT8,
  distance_km           FLOAT8,
  cover_photo_key       VARCHAR,
  avg_rating            NUMERIC,
  total_reviews         BIGINT,
  landlord_owner_id     UUID
) AS $$
DECLARE
  v_point GEOMETRY;
BEGIN
  -- Build search point from lat/lng
  v_point := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326);

  RETURN QUERY
  SELECT
    p.id,
    p.property_display_name,
    p.municipality_city,
    p.gender_segregation_policy,
    p.structural_amenities,
    p.total_beds,
    p.vacant_beds,
    p.min_rent,
    p.max_rent,
    ST_Y(p.geo_coordinate_point::geometry)::FLOAT8 AS latitude,
    ST_X(p.geo_coordinate_point::geometry)::FLOAT8 AS longitude,
    ROUND((ST_Distance(
      p.geo_coordinate_point::geography,
      v_point::geography
    ) / 1000.0)::NUMERIC, 2)::FLOAT8 AS distance_km,
    ph.s3_key                     AS cover_photo_key,
    rs.avg_rating,
    rs.total_reviews,
    p.landlord_owner_id
  FROM properties p
  LEFT JOIN property_photos ph
    ON ph.property_id = p.id AND ph.is_cover = TRUE
  LEFT JOIN property_rating_summary rs
    ON rs.property_id = p.id
  WHERE
    p.deleted_at IS NULL
    AND p.is_active = TRUE
    AND p.verification_status = 'VERIFIED'
    AND p.vacant_beds > 0
    -- Spatial: within radius
    AND ST_DWithin(
      p.geo_coordinate_point::geography,
      v_point::geography,
      p_radius_km * 1000  -- convert km to meters
    )
    -- Optional filters
    AND (p_gender_policy IS NULL OR p.gender_segregation_policy = p_gender_policy)
    AND (p_min_rent IS NULL OR p.min_rent >= p_min_rent)
    AND (p_max_rent IS NULL OR p.max_rent <= p_max_rent)
    AND (p_amenities IS NULL OR p.structural_amenities @> p_amenities)
  ORDER BY distance_km ASC, p.vacant_beds DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION search_properties_in_radius IS 'PostGIS radius search for available properties. Uses ST_DWithin with geographic (meter-accurate) distance calculation. Target: <200ms with GiST index.';

-- ─────────────────────────────────────────────
-- Function: Initialize booking with distributed lock check
-- Called by booking service AFTER Redis lock is acquired
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION initialize_booking_transaction(
  p_bed_id          UUID,
  p_tenant_id       UUID,
  p_check_in_date   DATE,
  p_idempotency_key VARCHAR,
  p_lock_expires_at TIMESTAMPTZ,
  p_lock_redis_key  VARCHAR
)
RETURNS TABLE (
  booking_id            UUID,
  monthly_rent          NUMERIC,
  security_deposit      NUMERIC,
  token_deposit_amount  NUMERIC,
  property_name         VARCHAR,
  room_code             VARCHAR,
  bed_code              VARCHAR
) AS $$
DECLARE
  v_bed            beds%ROWTYPE;
  v_room           rooms%ROWTYPE;
  v_property       properties%ROWTYPE;
  v_booking_id     UUID;
BEGIN
  -- 1. Lock the bed row (SELECT FOR UPDATE)
  SELECT * INTO v_bed
  FROM beds
  WHERE id = p_bed_id
  FOR UPDATE NOWAIT;  -- NOWAIT = fail immediately if row is locked

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BED_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  -- 2. Validate bed is still VACANT
  IF v_bed.current_occupancy_status <> 'VACANT' THEN
    RAISE EXCEPTION 'BED_NOT_VACANT' USING ERRCODE = 'P0002';
  END IF;

  -- 3. Idempotency check
  SELECT id INTO v_booking_id FROM bookings WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RAISE EXCEPTION 'IDEMPOTENCY_KEY_EXISTS:%', v_booking_id USING ERRCODE = 'P0003';
  END IF;

  -- 4. Get room details
  SELECT * INTO v_room FROM rooms WHERE id = v_bed.room_parent_id;
  SELECT * INTO v_property FROM properties WHERE id = v_room.property_parent_id;

  -- 5. Update bed status to RESERVED
  UPDATE beds
  SET current_occupancy_status = 'RESERVED',
      last_modified_timestamp  = NOW()
  WHERE id = p_bed_id;

  -- 6. Create booking record
  v_booking_id := uuid_generate_v4();
  INSERT INTO bookings (
    id, tenant_user_id, assigned_bed_id,
    current_booking_lifecycle_state,
    scheduled_check_in_date,
    monthly_rent_amount, security_deposit_amount,
    reservation_lock_expires_at, lock_redis_key,
    idempotency_key
  ) VALUES (
    v_booking_id, p_tenant_id, p_bed_id,
    'PENDING',
    p_check_in_date,
    v_room.standard_monthly_rent_amount,
    v_room.required_security_deposit_amount,
    p_lock_expires_at,
    p_lock_redis_key,
    p_idempotency_key
  );

  RETURN QUERY
  SELECT
    v_booking_id,
    v_room.standard_monthly_rent_amount,
    v_room.required_security_deposit_amount,
    v_room.token_deposit_amount,
    v_property.property_display_name,
    v_room.room_identifier_code,
    v_bed.bed_spatial_code;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────
-- Function: Confirm booking after successful payment
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION confirm_booking_after_payment(
  p_booking_id UUID,
  p_payment_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_booking bookings%ROWTYPE;
BEGIN
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking % not found', p_booking_id;
  END IF;

  IF v_booking.current_booking_lifecycle_state NOT IN ('PENDING') THEN
    RAISE EXCEPTION 'Booking % is in invalid state: %', p_booking_id, v_booking.current_booking_lifecycle_state;
  END IF;

  -- Confirm booking
  UPDATE bookings
  SET current_booking_lifecycle_state = 'CONFIRMED',
      token_fee_amount_paid = (
        SELECT exact_financial_amount FROM payments WHERE id = p_payment_id
      ),
      reservation_lock_expires_at = NULL,
      lock_redis_key = NULL,
      updated_at = NOW()
  WHERE id = p_booking_id;

  -- Move bed from RESERVED to OCCUPIED
  UPDATE beds
  SET current_occupancy_status = 'OCCUPIED',
      last_modified_timestamp  = NOW()
  WHERE id = v_booking.assigned_bed_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────
-- Function: Release expired reservation
-- Called by BullMQ worker when lock TTL expires
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION release_expired_reservation(p_booking_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_booking bookings%ROWTYPE;
BEGIN
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;

  IF NOT FOUND OR v_booking.current_booking_lifecycle_state <> 'PENDING' THEN
    RETURN FALSE;  -- already confirmed or cancelled
  END IF;

  -- Release bed back to VACANT
  UPDATE beds
  SET current_occupancy_status = 'VACANT',
      last_modified_timestamp  = NOW()
  WHERE id = v_booking.assigned_bed_id;

  -- Cancel the booking
  UPDATE bookings
  SET current_booking_lifecycle_state = 'CANCELLED',
      cancellation_reason = 'RESERVATION_EXPIRED',
      cancelled_at = NOW(),
      updated_at   = NOW()
  WHERE id = p_booking_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────
-- Function: Cancel booking (by tenant or admin)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION cancel_booking(
  p_booking_id    UUID,
  p_cancelled_by  UUID,
  p_reason        TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_booking bookings%ROWTYPE;
BEGIN
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_booking.current_booking_lifecycle_state NOT IN ('PENDING', 'CONFIRMED') THEN
    RAISE EXCEPTION 'Cannot cancel booking in state: %', v_booking.current_booking_lifecycle_state;
  END IF;

  -- Return bed to VACANT
  UPDATE beds
  SET current_occupancy_status = 'VACANT',
      last_modified_timestamp  = NOW()
  WHERE id = v_booking.assigned_bed_id;

  -- Update booking
  UPDATE bookings
  SET current_booking_lifecycle_state = 'CANCELLED',
      cancellation_reason  = p_reason,
      cancelled_at         = NOW(),
      cancelled_by_user_id = p_cancelled_by,
      updated_at           = NOW()
  WHERE id = p_booking_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
