#!/usr/bin/env bash
# ─────────────────────────────────────────────
# Database Initialization Script
# Runs automatically via docker-entrypoint-initdb.d on first container start.
# Applies all migrations in order, then optionally seeds dev data.
# ─────────────────────────────────────────────

set -euo pipefail

MIGRATIONS_DIR="/database/migrations"
SEEDS_DIR="/database/seeds"

echo "[init.sql] Applying migrations from $MIGRATIONS_DIR"

for migration in "$MIGRATIONS_DIR"/*.sql; do
  echo "[init.sql] → $(basename "$migration")"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$migration"
done

if [[ "${SEED_ON_INIT:-false}" == "true" ]]; then
  echo "[init.sql] Seeding development data..."
  for seed in "$SEEDS_DIR"/*.sql; do
    echo "[init.sql] → $(basename "$seed")"
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$seed"
  done
fi

echo "[init.sql] ✅ Database initialization complete"
