#!/usr/bin/env bash
# ─────────────────────────────────────────────
# PostgreSQL Backup Script
# Schedule: 0 2 * * * /usr/local/bin/backup.sh >> /var/log/pgbooking-backup.log 2>&1
# ─────────────────────────────────────────────

set -euo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_NAME="${POSTGRES_DB:-pgbooking_prod}"
DB_USER="${POSTGRES_USER:-pgbooking_user}"
BACKUP_DIR="/tmp/pgbooking_backups"
BACKUP_FILE="$BACKUP_DIR/pgbooking_${DB_NAME}_${TIMESTAMP}.sql.gz"
S3_BUCKET="${BACKUP_S3_BUCKET:-pgbooking-backups-prod}"
S3_PREFIX="database-backups"
RETENTION_DAYS=30

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Starting backup: $BACKUP_FILE"
mkdir -p "$BACKUP_DIR"

# ── Dump database ───────────────────────────
pg_dump \
  --host="${POSTGRES_HOST:-localhost}" \
  --port="${POSTGRES_PORT:-5432}" \
  --username="$DB_USER" \
  --dbname="$DB_NAME" \
  --format=custom \
  --compress=9 \
  --verbose \
  2>/tmp/pgdump_stderr.log \
  | gzip > "$BACKUP_FILE"

BACKUP_SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
echo "Backup created: $BACKUP_FILE ($BACKUP_SIZE)"

# ── Upload to S3 ────────────────────────────
aws s3 cp "$BACKUP_FILE" \
  "s3://${S3_BUCKET}/${S3_PREFIX}/$(basename $BACKUP_FILE)" \
  --sse AES256 \
  --storage-class STANDARD_IA

echo "Uploaded to s3://${S3_BUCKET}/${S3_PREFIX}/$(basename $BACKUP_FILE)"

# ── Verify backup integrity ─────────────────
pg_restore --list "$BACKUP_FILE" > /dev/null 2>&1 \
  && echo "Backup integrity check: PASSED" \
  || { echo "Backup integrity check: FAILED" && exit 1; }

# ── Clean up old local backups ──────────────
find "$BACKUP_DIR" -name "*.sql.gz" -mtime "+2" -delete
echo "Local backup cleanup complete"

# ── Remove old S3 backups (retention policy) ─
aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/" \
  | awk '{print $4}' \
  | while read -r key; do
      FILE_DATE=$(echo "$key" | grep -oP '\d{8}' | head -1)
      if [[ -n "$FILE_DATE" ]]; then
        FILE_EPOCH=$(date -d "$FILE_DATE" +%s 2>/dev/null || date -j -f "%Y%m%d" "$FILE_DATE" +%s 2>/dev/null || echo 0)
        CUTOFF_EPOCH=$(date -d "-${RETENTION_DAYS} days" +%s 2>/dev/null || date -v-${RETENTION_DAYS}d +%s 2>/dev/null || echo 0)
        if [[ $FILE_EPOCH -lt $CUTOFF_EPOCH && $FILE_EPOCH -gt 0 ]]; then
          aws s3 rm "s3://${S3_BUCKET}/${S3_PREFIX}/$key"
          echo "Deleted old backup: $key"
        fi
      fi
    done

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Backup complete ✅"
