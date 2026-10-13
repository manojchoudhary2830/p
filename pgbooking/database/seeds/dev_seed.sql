-- ─────────────────────────────────────────────
-- Development Seed Data
-- ─────────────────────────────────────────────
-- Run AFTER all migrations have been applied:
--   psql $DATABASE_URL -f database/seeds/dev_seed.sql
--
-- Guard: will refuse to run against a database that doesn't
-- contain "dev" or "test" in its name (safety net for prod).
-- ─────────────────────────────────────────────

DO $$
BEGIN
  IF current_database() NOT LIKE '%dev%' AND current_database() NOT LIKE '%test%' THEN
    RAISE EXCEPTION 'Seed data can only be loaded into development/test databases. Current DB: %', current_database();
  END IF;
END $$;

-- ─────────────────────────────────────────────
-- Users
-- ─────────────────────────────────────────────

INSERT INTO users (id, phone_number, email_address, legal_full_name, account_role, identity_kyc_status)
VALUES
  ('00000000-0000-0000-0000-000000000001', '+919876543210', 'admin@pgbooking.dev', 'System Administrator', 'SYSTEM_ADMIN', 'VERIFIED'),
  ('00000000-0000-0000-0000-000000000002', '+919876543211', 'owner1@pgbooking.dev', 'Rajesh Sharma', 'OWNER', 'VERIFIED'),
  ('00000000-0000-0000-0000-000000000003', '+919876543212', 'owner2@pgbooking.dev', 'Priya Menon', 'OWNER', 'VERIFIED'),
  ('00000000-0000-0000-0000-000000000004', '+919876543213', 'tenant1@pgbooking.dev', 'Arjun Kumar', 'TENANT', 'VERIFIED'),
  ('00000000-0000-0000-0000-000000000005', '+919876543214', 'tenant2@pgbooking.dev', 'Sneha Patel', 'TENANT', 'UNVERIFIED'),
  ('00000000-0000-0000-0000-000000000006', '+919876543215', 'tenant3@pgbooking.dev', 'Rahul Gupta', 'TENANT', 'VERIFIED')
ON CONFLICT (phone_number) DO NOTHING;

-- ─────────────────────────────────────────────
-- Properties (Bengaluru coordinates)
-- ─────────────────────────────────────────────

INSERT INTO properties (
  id, landlord_owner_id, property_display_name, descriptive_summary,
  physical_address_line, municipality_city, state, pincode,
  geo_coordinate_point, gender_segregation_policy, structural_amenities,
  is_listing_verified_by_admin, verification_status, is_active,
  total_beds, vacant_beds, min_rent, max_rent
) VALUES
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    'Urban Nest Premium Co-Living HSR Layout',
    'Modern co-living PG near Outer Ring Road, perfect for IT professionals.',
    '43, 27th Main, Sector 1, HSR Layout',
    'Bengaluru', 'Karnataka', '560102',
    ST_SetSRID(ST_MakePoint(77.6412, 12.9141), 4326),
    'CO_LIVING',
    ARRAY['HIGH_SPEED_WIFI', 'POWER_BACKUP', 'AIR_CONDITIONING', 'LAUNDRY', 'HOUSEKEEPING', 'MEALS'],
    TRUE, 'VERIFIED', TRUE, 20, 12, 8000, 18000
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    'Koramangala Girls PG - Safe & Secure',
    'Premium girls PG in the heart of Koramangala with CCTV surveillance.',
    '5th Block, 80 Feet Road, Koramangala',
    'Bengaluru', 'Karnataka', '560095',
    ST_SetSRID(ST_MakePoint(77.6155, 12.9352), 4326),
    'FEMALE',
    ARRAY['HIGH_SPEED_WIFI', 'POWER_BACKUP', 'GEYSER', 'SECURITY', 'MEALS', 'HOUSEKEEPING'],
    TRUE, 'VERIFIED', TRUE, 15, 8, 7000, 14000
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000003',
    'Whitefield Tech Park PG - Male Only',
    'Affordable PG for software engineers near ITPL.',
    'Near ITPL Gate 2, Whitefield',
    'Bengaluru', 'Karnataka', '560066',
    ST_SetSRID(ST_MakePoint(77.7480, 12.9698), 4326),
    'MALE',
    ARRAY['HIGH_SPEED_WIFI', 'POWER_BACKUP', 'GYM', 'PARKING'],
    TRUE, 'VERIFIED', TRUE, 30, 18, 6000, 12000
  )
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────
-- Rooms
-- ─────────────────────────────────────────────

INSERT INTO rooms (id, property_parent_id, room_identifier_code, floor_level_index, max_occupancy_sharing_limit, standard_monthly_rent_amount, required_security_deposit_amount, room_type)
VALUES
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '101', 1, 1, 18000, 36000, 'DELUXE'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '102', 1, 2, 12000, 24000, 'STANDARD'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '201', 2, 3, 8000,  16000, 'ECONOMY'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', 'A1',  1, 1, 14000, 28000, 'DELUXE'),
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002', 'A2',  1, 2, 9000,  18000, 'STANDARD'),
  ('20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000003', 'G1',  0, 3, 6000,  12000, 'ECONOMY'),
  ('20000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000003', 'G2',  0, 4, 7000,  14000, 'ECONOMY')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────
-- Beds
-- ─────────────────────────────────────────────

INSERT INTO beds (id, room_parent_id, bed_spatial_code, current_occupancy_status)
VALUES
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'A', 'VACANT'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'A', 'OCCUPIED'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', 'B', 'VACANT'),
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000003', 'A', 'VACANT'),
  ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000003', 'B', 'VACANT'),
  ('30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000003', 'C', 'OCCUPIED'),
  ('30000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000004', 'A', 'VACANT'),
  ('30000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000005', 'A', 'VACANT'),
  ('30000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000005', 'B', 'OCCUPIED'),
  ('30000000-0000-0000-0000-000000000010', '20000000-0000-0000-0000-000000000006', 'A', 'VACANT'),
  ('30000000-0000-0000-0000-000000000011', '20000000-0000-0000-0000-000000000006', 'B', 'VACANT'),
  ('30000000-0000-0000-0000-000000000012', '20000000-0000-0000-0000-000000000006', 'C', 'OCCUPIED')
ON CONFLICT (id) DO NOTHING;
