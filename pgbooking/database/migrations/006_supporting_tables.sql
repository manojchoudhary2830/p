-- Migration: 006_supporting_tables
-- Description: KYC, maintenance, notifications, favorites, reviews, audit logs

-- ─────────────────────────────────────────────
-- Table: kyc_documents
-- ─────────────────────────────────────────────
CREATE TABLE kyc_documents (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_type     kyc_doc_type_enum NOT NULL,
  s3_key            VARCHAR(500) NOT NULL,   -- encrypted private bucket key
  document_number   VARCHAR(50),             -- stored encrypted
  verification_status kyc_status_enum NOT NULL DEFAULT 'PENDING_REVIEW',
  reviewed_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at       TIMESTAMPTZ,
  rejection_reason  TEXT,
  expires_at        DATE,                    -- for Passport, DL expiry
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER kyc_documents_updated_at
  BEFORE UPDATE ON kyc_documents
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_kyc_user           ON kyc_documents(user_id);
CREATE INDEX idx_kyc_status         ON kyc_documents(verification_status);
CREATE INDEX idx_kyc_user_status    ON kyc_documents(user_id, verification_status);

-- When KYC is approved/rejected, sync to user table
CREATE OR REPLACE FUNCTION trigger_sync_user_kyc_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.verification_status IN ('VERIFIED', 'REJECTED') THEN
    UPDATE users
    SET identity_kyc_status = NEW.verification_status,
        record_updated_at   = NOW()
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER kyc_sync_user_status
  AFTER UPDATE OF verification_status ON kyc_documents
  FOR EACH ROW EXECUTE FUNCTION trigger_sync_user_kyc_status();

-- ─────────────────────────────────────────────
-- Table: maintenance_tickets
-- ─────────────────────────────────────────────
CREATE TABLE maintenance_tickets (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id              UUID NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  reported_by_user_id     UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  assigned_to_owner_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  title                   VARCHAR(200) NOT NULL,
  description             TEXT NOT NULL,
  category                maintenance_category_enum NOT NULL DEFAULT 'OTHER',
  current_status          maintenance_status_enum NOT NULL DEFAULT 'OPEN',
  photo_s3_keys           TEXT[] NOT NULL DEFAULT '{}',
  resolution_notes        TEXT,
  resolved_at             TIMESTAMPTZ,
  closed_at               TIMESTAMPTZ,
  priority                SMALLINT NOT NULL DEFAULT 2 CHECK (priority BETWEEN 1 AND 5),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER maintenance_tickets_updated_at
  BEFORE UPDATE ON maintenance_tickets
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_maintenance_booking     ON maintenance_tickets(booking_id);
CREATE INDEX idx_maintenance_reporter    ON maintenance_tickets(reported_by_user_id);
CREATE INDEX idx_maintenance_owner       ON maintenance_tickets(assigned_to_owner_id) WHERE assigned_to_owner_id IS NOT NULL;
CREATE INDEX idx_maintenance_status      ON maintenance_tickets(current_status);
CREATE INDEX idx_maintenance_category    ON maintenance_tickets(category);

-- ─────────────────────────────────────────────
-- Table: maintenance_comments
-- ─────────────────────────────────────────────
CREATE TABLE maintenance_comments (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id    UUID NOT NULL REFERENCES maintenance_tickets(id) ON DELETE CASCADE,
  author_id    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  content      TEXT NOT NULL,
  is_internal  BOOLEAN NOT NULL DEFAULT FALSE,  -- owner-only notes
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mc_ticket  ON maintenance_comments(ticket_id, created_at DESC);
CREATE INDEX idx_mc_author  ON maintenance_comments(author_id);

-- ─────────────────────────────────────────────
-- Table: notifications
-- ─────────────────────────────────────────────
CREATE TABLE notifications (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type         notification_type_enum NOT NULL,
  channel      notification_channel_enum NOT NULL DEFAULT 'IN_APP',
  title        VARCHAR(200) NOT NULL,
  body         TEXT NOT NULL,
  data         JSONB,                     -- arbitrary payload for deep-linking
  is_read      BOOLEAN NOT NULL DEFAULT FALSE,
  sent_at      TIMESTAMPTZ,
  read_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user
  ON notifications(user_id, created_at DESC) WHERE is_read = FALSE;

CREATE INDEX idx_notifications_user_all
  ON notifications(user_id, created_at DESC);

CREATE INDEX idx_notifications_type
  ON notifications(type);

-- ─────────────────────────────────────────────
-- Table: favorites
-- ─────────────────────────────────────────────
CREATE TABLE favorites (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id  UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_favorites_user_property UNIQUE (user_id, property_id)
);

CREATE INDEX idx_favorites_user  ON favorites(user_id);
CREATE INDEX idx_favorites_property ON favorites(property_id);

-- ─────────────────────────────────────────────
-- Table: reviews
-- ─────────────────────────────────────────────
CREATE TABLE reviews (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id     UUID NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE RESTRICT,
  reviewer_id    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  property_id    UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  rating         SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title          VARCHAR(200),
  content        TEXT,
  is_approved    BOOLEAN NOT NULL DEFAULT FALSE,
  approved_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER reviews_updated_at
  BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_reviews_property    ON reviews(property_id) WHERE is_approved = TRUE;
CREATE INDEX idx_reviews_reviewer    ON reviews(reviewer_id);
CREATE INDEX idx_reviews_rating      ON reviews(property_id, rating);

-- Materialized view for property average ratings (refresh periodically)
CREATE MATERIALIZED VIEW property_rating_summary AS
SELECT
  property_id,
  COUNT(*)                AS total_reviews,
  AVG(rating)::NUMERIC(3,2) AS avg_rating,
  SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) AS five_star_count
FROM reviews
WHERE is_approved = TRUE
GROUP BY property_id;

CREATE UNIQUE INDEX idx_rating_summary_property ON property_rating_summary(property_id);

-- ─────────────────────────────────────────────
-- Table: audit_logs
-- ─────────────────────────────────────────────
CREATE TABLE audit_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  action        VARCHAR(200) NOT NULL,
  entity_type   VARCHAR(100) NOT NULL,
  entity_id     UUID,
  old_values    JSONB,
  new_values    JSONB,
  ip_address    INET,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partition hint: in production, partition by created_at (monthly)
CREATE INDEX idx_audit_user       ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_entity     ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_action     ON audit_logs(action);
CREATE INDEX idx_audit_created_at ON audit_logs(created_at DESC);

COMMENT ON TABLE audit_logs IS 'Append-only audit trail for all write operations. Never update or delete rows.';
