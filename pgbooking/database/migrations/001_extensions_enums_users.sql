-- Migration: 001_extensions_enums_users
-- Created: 2026-01-01
-- Description: Load extensions, create all custom enum types, and core users table

-- ─────────────────────────────────────────────
-- Extensions
-- ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- for fuzzy text search

-- ─────────────────────────────────────────────
-- Custom Enum Types
-- ─────────────────────────────────────────────
CREATE TYPE user_role_enum AS ENUM ('TENANT', 'OWNER', 'SYSTEM_ADMIN');
CREATE TYPE gender_policy_enum AS ENUM ('MALE', 'FEMALE', 'CO_LIVING');
CREATE TYPE bed_status_enum AS ENUM ('VACANT', 'RESERVED', 'OCCUPIED');
CREATE TYPE booking_status_enum AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'CHECKED_OUT');
CREATE TYPE payment_purpose_enum AS ENUM ('TOKEN_DEPOSIT', 'MONTHLY_RENT', 'SECURITY_DEPOSIT', 'UTILITY_ARREARS', 'REFUND');
CREATE TYPE payment_status_enum AS ENUM ('PENDING', 'PROCESSING', 'SUCCESSFUL', 'FAILED', 'REFUNDED');
CREATE TYPE kyc_status_enum AS ENUM ('UNVERIFIED', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED');
CREATE TYPE kyc_doc_type_enum AS ENUM ('AADHAAR', 'PAN_CARD', 'PASSPORT', 'DRIVING_LICENSE', 'VOTER_ID');
CREATE TYPE maintenance_status_enum AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
CREATE TYPE maintenance_category_enum AS ENUM ('PLUMBING', 'ELECTRICAL', 'FURNITURE', 'CLEANING', 'INTERNET', 'APPLIANCE', 'SECURITY', 'OTHER');
CREATE TYPE notification_type_enum AS ENUM ('OTP', 'BOOKING_CREATED', 'BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'PAYMENT_RECEIVED', 'PAYMENT_DUE', 'PAYMENT_OVERDUE', 'MAINTENANCE_CREATED', 'MAINTENANCE_UPDATED', 'KYC_APPROVED', 'KYC_REJECTED', 'PROPERTY_APPROVED', 'RENT_INVOICE', 'GENERAL');
CREATE TYPE notification_channel_enum AS ENUM ('PUSH', 'EMAIL', 'SMS', 'IN_APP');
CREATE TYPE property_verification_status_enum AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED');

-- ─────────────────────────────────────────────
-- Timestamp trigger function (reusable)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────
-- Table: users
-- ─────────────────────────────────────────────
CREATE TABLE users (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone_number          VARCHAR(15)  UNIQUE NOT NULL,
  email_address         VARCHAR(255) UNIQUE,
  legal_full_name       VARCHAR(120) NOT NULL,
  account_role          user_role_enum NOT NULL DEFAULT 'TENANT',
  identity_kyc_status   kyc_status_enum NOT NULL DEFAULT 'UNVERIFIED',
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at         TIMESTAMPTZ,
  profile_photo_key     VARCHAR(500),
  fcm_token             VARCHAR(500),    -- Firebase Cloud Messaging device token
  device_id             VARCHAR(255),
  record_created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  record_updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ    -- soft delete
);

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Indexes
CREATE INDEX idx_users_phone           ON users(phone_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_email           ON users(email_address) WHERE email_address IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_users_role            ON users(account_role) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_kyc_status      ON users(identity_kyc_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_active          ON users(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_deleted_at      ON users(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_users_name_trgm       ON users USING GIN(legal_full_name gin_trgm_ops);

COMMENT ON TABLE users IS 'Core user accounts for all roles (TENANT, OWNER, SYSTEM_ADMIN)';
COMMENT ON COLUMN users.deleted_at IS 'Soft-delete timestamp. NULL = active record.';
COMMENT ON COLUMN users.fcm_token IS 'Firebase Cloud Messaging token for push notifications';
