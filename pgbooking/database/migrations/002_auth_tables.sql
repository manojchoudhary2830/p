-- Migration: 002_auth_tables
-- Description: OTP attempt tracking and refresh token management

-- ─────────────────────────────────────────────
-- Table: otp_logs
-- ─────────────────────────────────────────────
CREATE TABLE otp_logs (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone_number     VARCHAR(15) NOT NULL,
  otp_hash         VARCHAR(64) NOT NULL,
  attempts         SMALLINT NOT NULL DEFAULT 0,
  is_used          BOOLEAN NOT NULL DEFAULT FALSE,
  is_locked        BOOLEAN NOT NULL DEFAULT FALSE,
  lock_expires_at  TIMESTAMPTZ,
  ip_address       INET,
  expires_at       TIMESTAMPTZ NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_at          TIMESTAMPTZ
);

-- FIX: NOW() is a volatile function — cannot be used in index predicates (ERROR 42P17).
-- The application layer enforces expiry; this index only prevents duplicate active OTPs.
CREATE UNIQUE INDEX idx_otp_logs_phone_active
  ON otp_logs(phone_number)
  WHERE is_used = FALSE;

CREATE INDEX idx_otp_logs_phone      ON otp_logs(phone_number);
CREATE INDEX idx_otp_logs_expires_at ON otp_logs(expires_at);
CREATE INDEX idx_otp_logs_created_at ON otp_logs(created_at DESC);

COMMENT ON TABLE otp_logs IS 'OTP generation, verification attempts, and lockout state per phone number.';
COMMENT ON COLUMN otp_logs.otp_hash IS 'SHA-256(otp). Never stored in plaintext.';

-- ─────────────────────────────────────────────
-- Table: refresh_tokens
-- ─────────────────────────────────────────────
CREATE TABLE refresh_tokens (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash        VARCHAR(64) NOT NULL UNIQUE,
  token_family      UUID NOT NULL,
  expires_at        TIMESTAMPTZ NOT NULL,
  is_revoked        BOOLEAN NOT NULL DEFAULT FALSE,
  revoked_at        TIMESTAMPTZ,
  revocation_reason VARCHAR(100),
  device_info       JSONB,
  ip_address        INET,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user_id     ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token_hash  ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_family      ON refresh_tokens(token_family);
CREATE INDEX idx_refresh_tokens_expires_at  ON refresh_tokens(expires_at) WHERE is_revoked = FALSE;
CREATE INDEX idx_refresh_tokens_user_active ON refresh_tokens(user_id)    WHERE is_revoked = FALSE;

COMMENT ON TABLE refresh_tokens IS 'Refresh token storage with rotation. token_family enables reuse-attack detection.';
