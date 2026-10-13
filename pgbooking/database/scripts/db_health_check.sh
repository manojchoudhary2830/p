#!/usr/bin/env bash
# ─────────────────────────────────────────────
# Database Diagnostic Script
# Reports table sizes, index usage, slow queries, and connection stats.
# Usage: DATABASE_URL=postgresql://... ./db_health_check.sh
# ─────────────────────────────────────────────

set -euo pipefail
DATABASE_URL="${DATABASE_URL:?Error: DATABASE_URL environment variable is required}"

echo "═══════════════════════════════════════════"
echo " PG Booking — Database Health Report"
echo "═══════════════════════════════════════════"

echo -e "\n📊 Table Sizes"
psql "$DATABASE_URL" -c "
  SELECT relname AS table_name,
         pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
         pg_size_pretty(pg_relation_size(relid)) AS table_size
  FROM pg_catalog.pg_statio_user_tables
  ORDER BY pg_total_relation_size(relid) DESC
  LIMIT 15;
"

echo -e "\n🔍 Index Usage"
psql "$DATABASE_URL" -c "
  SELECT relname AS table_name, indexrelname AS index_name, idx_scan AS scans
  FROM pg_stat_user_indexes
  ORDER BY idx_scan ASC
  LIMIT 10;
"

echo -e "\n🐢 Unused Indexes (candidates for removal)"
psql "$DATABASE_URL" -c "
  SELECT relname AS table_name, indexrelname AS index_name
  FROM pg_stat_user_indexes
  WHERE idx_scan = 0 AND indexrelname NOT LIKE '%_pkey'
  LIMIT 10;
"

echo -e "\n🔌 Active Connections"
psql "$DATABASE_URL" -c "
  SELECT state, COUNT(*) FROM pg_stat_activity
  WHERE datname = current_database()
  GROUP BY state;
"

echo -e "\n🗺  PostGIS Spatial Index Check"
psql "$DATABASE_URL" -c "
  SELECT indexname FROM pg_indexes
  WHERE tablename = 'properties' AND indexdef LIKE '%gist%';
"

echo -e "\n✅ Health check complete"
