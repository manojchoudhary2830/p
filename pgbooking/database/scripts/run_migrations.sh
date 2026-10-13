#!/usr/bin/env bash
# ─────────────────────────────────────────────
# Manual Migration Runner
# Applies all .sql files in database/migrations/ in lexical order.
# Tracks applied migrations in a `schema_migrations` table to stay idempotent.
#
# Usage:
#   DATABASE_URL=postgresql://user:pass@host:5432/db ./run_migrations.sh
# ─────────────────────────────────────────────

set -euo pipefail

DATABASE_URL="${DATABASE_URL:?Error: DATABASE_URL environment variable is required}"
MIGRATIONS_DIR="$(dirname "$0")/../migrations"

echo "Ensuring schema_migrations tracking table exists..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
"

for migration in "$MIGRATIONS_DIR"/*.sql; do
  filename=$(basename "$migration")
  version="${filename%.sql}"

  already_applied=$(psql "$DATABASE_URL" -t -c \
    "SELECT 1 FROM schema_migrations WHERE version = '$version'" | tr -d '[:space:]')

  if [[ "$already_applied" == "1" ]]; then
    echo "⏭  Skipping (already applied): $filename"
    continue
  fi

  echo "▶  Applying: $filename"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration"
  psql "$DATABASE_URL" -c "INSERT INTO schema_migrations (version) VALUES ('$version')"
  echo "✅ Applied: $filename"
done

echo "✅ All migrations up to date"
