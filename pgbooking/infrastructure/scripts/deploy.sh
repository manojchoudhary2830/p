#!/usr/bin/env bash
# ─────────────────────────────────────────────
# PG Booking — Production Deployment Script
# Usage: ./deploy.sh [staging|production] [image_tag]
# ─────────────────────────────────────────────

set -euo pipefail
IFS=$'\n\t'

ENVIRONMENT="${1:-staging}"
IMAGE_TAG="${2:-latest}"
COMPOSE_FILE="docker-compose.prod.yml"
DEPLOY_DIR="/opt/pgbooking"
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

log()   { echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }
die()   { error "$*"; exit 1; }

case "$ENVIRONMENT" in
  staging)    HEALTH_URL="https://staging.pgbooking.in/health" ;;
  production) HEALTH_URL="https://api.pgbooking.in/health" ;;
  *)          die "Unknown environment: $ENVIRONMENT. Use 'staging' or 'production'" ;;
esac

log "Deploying to $ENVIRONMENT with tag=$IMAGE_TAG"
cd "$DEPLOY_DIR" || die "Deploy dir $DEPLOY_DIR not found"

# ── Pre-deploy checks ─────────────────────────
log "Running pre-deploy checks..."
command -v docker >/dev/null 2>&1            || die "Docker not installed"
command -v docker compose >/dev/null 2>&1    || die "Docker Compose v2 not installed"
[[ -f ".env.production" ]]                   || die ".env.production file missing"
[[ -f "$COMPOSE_FILE" ]]                     || die "$COMPOSE_FILE not found"
[[ -f "database/scripts/run_migrations.sh" ]] || die "database/scripts/run_migrations.sh not found"

# ── Pull latest image ─────────────────────────
log "Pulling backend image: $IMAGE_TAG..."
IMAGE_TAG="$IMAGE_TAG" docker compose -f "$COMPOSE_FILE" pull backend

# ── Run migrations via one-off container ──────
# Uses the official postgres image (already present for the service),
# mounts the migrations directory, and connects over the internal Docker
# network — no need to expose the postgres port to the host.
log "Running database migrations..."
source .env.production 2>/dev/null || true

docker run --rm \
  --network pgbooking_prod \
  -v "$(pwd)/database/migrations:/migrations:ro" \
  -v "$(pwd)/database/scripts/run_migrations.sh:/run_migrations.sh:ro" \
  -e DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}" \
  postgres:16-alpine \
  sh /run_migrations.sh \
  && log "✅ Migrations complete" \
  || die "Migration failed — aborting deploy"

# ── Rolling update ────────────────────────────
log "Starting rolling update..."
IMAGE_TAG="$IMAGE_TAG" docker compose -f "$COMPOSE_FILE" up -d \
  --no-deps --scale backend=2 backend

log "Waiting 20 seconds for new instances to stabilise..."
sleep 20

# ── Health check ──────────────────────────────
log "Running health check at $HEALTH_URL..."
MAX_RETRIES=6; RETRY_DELAY=10

for i in $(seq 1 $MAX_RETRIES); do
  HTTP_STATUS=$(curl -s -o /tmp/health.json -w "%{http_code}" "$HEALTH_URL" || echo "000")
  if [[ "$HTTP_STATUS" == "200" ]]; then
    log "Health check passed (attempt $i/$MAX_RETRIES)"
    break
  else
    warn "Health check failed (HTTP $HTTP_STATUS, attempt $i/$MAX_RETRIES). Retrying in ${RETRY_DELAY}s..."
    sleep $RETRY_DELAY
    if [[ $i -eq $MAX_RETRIES ]]; then
      error "Health check failed after $MAX_RETRIES attempts — rolling back"
      IMAGE_TAG=previous docker compose -f "$COMPOSE_FILE" up -d --no-deps backend || true
      die "Deployment failed. Rollback attempted."
    fi
  fi
done

# ── Scale back to target replicas ────────────
TARGET_REPLICAS="${TARGET_REPLICAS:-2}"
IMAGE_TAG="$IMAGE_TAG" docker compose -f "$COMPOSE_FILE" up -d \
  --no-deps --scale backend="$TARGET_REPLICAS" backend

# ── Cleanup ───────────────────────────────────
docker image prune -f --filter "until=48h" || true
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) | $ENVIRONMENT | $IMAGE_TAG | SUCCESS" >> /var/log/pgbooking-deployments.log
log "✅ Deployment to $ENVIRONMENT complete!"
