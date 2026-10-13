-- Migration: 005_bookings_payments
-- Description: Bookings ledger and financial transactions with idempotency

-- ─────────────────────────────────────────────
-- Table: bookings
-- ─────────────────────────────────────────────
CREATE TABLE bookings (
  id                              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_user_id                  UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  assigned_bed_id                 UUID NOT NULL REFERENCES beds(id) ON DELETE RESTRICT,
  current_booking_lifecycle_state booking_status_enum NOT NULL DEFAULT 'PENDING',
  scheduled_check_in_date         DATE NOT NULL,
  scheduled_check_out_date        DATE,
  token_fee_amount_paid           NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  security_deposit_amount         NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  monthly_rent_amount             NUMERIC(12,2) NOT NULL,

  -- Reservation lock management
  reservation_lock_expires_at     TIMESTAMPTZ,
  lock_redis_key                  VARCHAR(200),  -- the Redis lock key for cleanup

  -- Idempotency: prevent duplicate booking initiation
  idempotency_key                 VARCHAR(100) UNIQUE,

  -- Cancellation
  cancelled_at                    TIMESTAMPTZ,
  cancellation_reason             TEXT,
  cancelled_by_user_id            UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Checkout
  actual_check_out_date           DATE,
  checkout_notes                  TEXT,

  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at                      TIMESTAMPTZ
);

CREATE TRIGGER bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ─────────────────────────────────────────────
-- Indexes on bookings
-- ─────────────────────────────────────────────

CREATE INDEX idx_bookings_tenant
  ON bookings(tenant_user_id) WHERE deleted_at IS NULL;

CREATE INDEX idx_bookings_bed
  ON bookings(assigned_bed_id) WHERE deleted_at IS NULL;

CREATE INDEX idx_bookings_status
  ON bookings(current_booking_lifecycle_state) WHERE deleted_at IS NULL;

CREATE INDEX idx_bookings_tenant_status
  ON bookings(tenant_user_id, current_booking_lifecycle_state) WHERE deleted_at IS NULL;

CREATE INDEX idx_bookings_lock_expires
  ON bookings(reservation_lock_expires_at)
  WHERE current_booking_lifecycle_state = 'PENDING'
    AND reservation_lock_expires_at IS NOT NULL;

CREATE INDEX idx_bookings_check_in
  ON bookings(scheduled_check_in_date) WHERE deleted_at IS NULL;

CREATE INDEX idx_bookings_idempotency
  ON bookings(idempotency_key) WHERE idempotency_key IS NOT NULL;

COMMENT ON TABLE bookings IS 'Central booking ledger. PENDING = reservation held. CONFIRMED = payment complete.';
COMMENT ON COLUMN bookings.idempotency_key IS 'Client-supplied key to prevent duplicate booking submissions.';
COMMENT ON COLUMN bookings.reservation_lock_expires_at IS '10-minute window. Bed returns to VACANT if payment not completed.';

-- ─────────────────────────────────────────────
-- Table: payments
-- ─────────────────────────────────────────────
CREATE TABLE payments (
  id                              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_context_id              UUID REFERENCES bookings(id) ON DELETE SET NULL,
  payer_user_id                   UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  exact_financial_amount          NUMERIC(12,2) NOT NULL CHECK (exact_financial_amount > 0),
  currency_code                   VARCHAR(3) NOT NULL DEFAULT 'INR',
  transaction_clearance_status    payment_status_enum NOT NULL DEFAULT 'PENDING',
  financial_payment_purpose       payment_purpose_enum NOT NULL,

  -- Razorpay references
  payment_gateway_order_id        VARCHAR(255) UNIQUE,   -- Razorpay order ID (order_xxx)
  payment_gateway_external_id     VARCHAR(255) UNIQUE,   -- Razorpay payment ID (pay_xxx)
  gateway_signature               VARCHAR(500),          -- HMAC signature from Razorpay

  -- Idempotency (prevent duplicate webhook processing)
  idempotency_key                 VARCHAR(100) UNIQUE NOT NULL,

  -- Failure info
  failure_reason                  VARCHAR(300),
  failure_code                    VARCHAR(100),

  -- Refund info
  refunded_at                     TIMESTAMPTZ,
  refund_gateway_id               VARCHAR(255),
  refund_amount                   NUMERIC(12,2),

  -- Raw gateway response for audit
  gateway_response                JSONB,

  transaction_timestamp           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ─────────────────────────────────────────────
-- Indexes on payments
-- ─────────────────────────────────────────────

CREATE INDEX idx_payments_booking
  ON payments(booking_context_id);

CREATE INDEX idx_payments_payer
  ON payments(payer_user_id);

CREATE INDEX idx_payments_status
  ON payments(transaction_clearance_status);

CREATE INDEX idx_payments_purpose
  ON payments(financial_payment_purpose);

CREATE INDEX idx_payments_gateway_order
  ON payments(payment_gateway_order_id) WHERE payment_gateway_order_id IS NOT NULL;

CREATE INDEX idx_payments_gateway_external
  ON payments(payment_gateway_external_id) WHERE payment_gateway_external_id IS NOT NULL;

CREATE INDEX idx_payments_timestamp
  ON payments(transaction_timestamp DESC);

CREATE INDEX idx_payments_payer_purpose
  ON payments(payer_user_id, financial_payment_purpose);

COMMENT ON TABLE payments IS 'Immutable financial audit log. Each row represents one payment event.';
COMMENT ON COLUMN payments.idempotency_key IS 'Prevents duplicate processing of Razorpay webhook events.';

-- ─────────────────────────────────────────────
-- View: active_bookings_with_context
-- For owner dashboard and admin panel
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW active_bookings_with_context AS
SELECT
  bk.id                             AS booking_id,
  bk.current_booking_lifecycle_state AS status,
  bk.scheduled_check_in_date,
  bk.scheduled_check_out_date,
  bk.monthly_rent_amount,
  bk.token_fee_amount_paid,
  bk.created_at                     AS booking_date,
  t.id                              AS tenant_id,
  t.legal_full_name                 AS tenant_name,
  t.phone_number                    AS tenant_phone,
  t.email_address                   AS tenant_email,
  b.id                              AS bed_id,
  b.bed_spatial_code,
  r.id                              AS room_id,
  r.room_identifier_code,
  r.floor_level_index,
  p.id                              AS property_id,
  p.property_display_name,
  p.municipality_city,
  p.landlord_owner_id               AS owner_id
FROM bookings bk
JOIN users t     ON t.id = bk.tenant_user_id
JOIN beds b      ON b.id = bk.assigned_bed_id
JOIN rooms r     ON r.id = b.room_parent_id
JOIN properties p ON p.id = r.property_parent_id
WHERE bk.deleted_at IS NULL
  AND bk.current_booking_lifecycle_state NOT IN ('CANCELLED');
