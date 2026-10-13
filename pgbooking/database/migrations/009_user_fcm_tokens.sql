-- ─────────────────────────────────────────────
-- Migration 009: User FCM Tokens
-- Stores per-device Firebase Cloud Messaging tokens for push notifications.
-- Separate table (vs single column on users) because one user can have
-- multiple devices (phone + tablet, or reinstalled app with new token).
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_fcm_tokens (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fcm_token         VARCHAR(500) NOT NULL,
  device_platform   VARCHAR(20) CHECK (device_platform IN ('ios', 'android', 'web')),
  device_model      VARCHAR(100),
  app_version       VARCHAR(20),
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  last_used_at      TIMESTAMPTZ DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_user_fcm_token UNIQUE (user_id, fcm_token)
);

-- ─────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────

-- Fetch active tokens for a user (used by sendPushToUser)
CREATE INDEX IF NOT EXISTS idx_user_fcm_tokens_user_active
  ON user_fcm_tokens (user_id)
  WHERE is_active = TRUE;

-- Clean up stale tokens by user
CREATE INDEX IF NOT EXISTS idx_user_fcm_tokens_user_id
  ON user_fcm_tokens (user_id);

-- ─────────────────────────────────────────────
-- Updated_at trigger
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_user_fcm_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_fcm_tokens_updated_at ON user_fcm_tokens;
CREATE TRIGGER trg_user_fcm_tokens_updated_at
  BEFORE UPDATE ON user_fcm_tokens
  FOR EACH ROW EXECUTE FUNCTION update_user_fcm_tokens_updated_at();

-- ─────────────────────────────────────────────
-- API: upsert token (insert or update last_used)
-- Called by PUT /api/v1/notifications/fcm-token
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION upsert_fcm_token(
  p_user_id        UUID,
  p_fcm_token      VARCHAR(500),
  p_platform       VARCHAR(20),
  p_device_model   VARCHAR(100),
  p_app_version    VARCHAR(20)
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO user_fcm_tokens (user_id, fcm_token, device_platform, device_model, app_version, is_active, last_used_at)
  VALUES (p_user_id, p_fcm_token, p_platform, p_device_model, p_app_version, TRUE, NOW())
  ON CONFLICT (user_id, fcm_token)
    DO UPDATE SET
      is_active       = TRUE,
      last_used_at    = NOW(),
      device_platform = COALESCE(EXCLUDED.device_platform, user_fcm_tokens.device_platform),
      device_model    = COALESCE(EXCLUDED.device_model,    user_fcm_tokens.device_model),
      app_version     = COALESCE(EXCLUDED.app_version,     user_fcm_tokens.app_version),
      updated_at      = NOW()
  RETURNING id INTO v_id;

  -- Deactivate old tokens for same user (keep max 5 devices per user)
  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY last_used_at DESC) AS rn
    FROM user_fcm_tokens WHERE user_id = p_user_id AND is_active = TRUE
  )
  UPDATE user_fcm_tokens SET is_active = FALSE
  WHERE id IN (SELECT id FROM ranked WHERE rn > 5);

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE user_fcm_tokens IS
  'Per-device Firebase Cloud Messaging tokens for push notification delivery. Multiple tokens per user (one per device). Stale tokens auto-deactivated after failed delivery or when > 5 devices per user.';
