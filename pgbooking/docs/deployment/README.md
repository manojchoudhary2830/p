# Deployment Guide

## Prerequisites

- A Linux server (Ubuntu 22.04+ recommended) with Docker 24+ and Docker Compose v2
- A domain name pointed at the server (for TLS via Let's Encrypt)
- Accounts/credentials for: AWS S3, Razorpay, Twilio, Firebase (FCM)
- GitHub repository secrets configured (see below)

## Environment Variables

Copy `.env.example` to `.env.production` in `apps/backend/` and fill in every
value. Critical ones to double-check before first deploy:

| Variable | Notes |
|---|---|
| `JWT_PRIVATE_KEY_PATH` / `JWT_PUBLIC_KEY_PATH` | Generate with `npm run keys:generate` — **never commit these** |
| `DATABASE_URL` | Use the internal Docker network hostname (`postgres`), not `localhost` |
| `REDIS_URL` | Same — internal hostname `redis` |
| `RAZORPAY_WEBHOOK_SECRET` | Set this in the Razorpay dashboard webhook config to match |
| `ENCRYPTION_KEY` | 32-byte hex string for AES-256-GCM, used to encrypt KYC document numbers |
| `CORS_ORIGINS` | Comma-separated list of allowed origins — do not use `*` in production |

## First-Time Server Setup

```bash
# 1. Clone the repository
git clone https://github.com/manojchoudhary2830/-nestpg.git /opt/pgbooking
cd /opt/pgbooking

# 2. Generate JWT signing keys
cd apps/backend
npm run keys:generate
cd ../..

# 3. Configure environment
cp apps/backend/.env.example apps/backend/.env.production
# edit apps/backend/.env.production with real values

# 4. Set up TLS certificate (first time only)
sudo apt install certbot -y
sudo certbot certonly --standalone -d api.pgbooking.in

# 5. Start the stack
docker compose -f docker-compose.prod.yml up -d

# 6. Run migrations (via one-off container on the internal Docker network)
docker run --rm \
  --network pgbooking_prod \
  -v $(pwd)/database/migrations:/migrations:ro \
  -v $(pwd)/database/scripts/run_migrations.sh:/run_migrations.sh:ro \
  -e DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}" \
  postgres:16-alpine sh /run_migrations.sh

# 7. Verify
curl https://api.pgbooking.in/health
```

## GitHub Actions Secrets

Set these under **Settings → Secrets and variables → Actions** on the
repository:

| Secret | Purpose |
|---|---|
| `PROD_HOST` | Production server IP/hostname |
| `PROD_USER` | SSH user (e.g. `ubuntu`) |
| `PROD_SSH_KEY` | Private key for SSH deploy access |
| `STAGING_HOST` / `STAGING_USER` / `STAGING_SSH_KEY` | Same, for staging |
| `SLACK_WEBHOOK_URL` | Optional — deploy notifications |

The pipeline at `infrastructure/github/workflows/ci-cd.yml` auto-deploys:
- `staging` branch → staging server
- `main` branch → production server (after integration tests pass on staging deploy)

## Manual Deployment

If you need to deploy outside of CI/CD:

```bash
./infrastructure/scripts/deploy.sh production latest
```

This script:
1. Pulls the specified image tag
2. Runs database migrations
3. Scales the backend to 2 replicas (old + new running together)
4. Health-checks the new instance
5. Scales back to the target replica count
6. **Automatically rolls back** if the health check fails after 6 retries

## Zero-Downtime Deploy Mechanics

The deploy script never stops all backend instances at once:

```
docker compose up -d --no-deps --scale backend=2 backend   # old + new both running
sleep 20 && curl /health                                    # verify new instance
docker compose up -d --no-deps --scale backend=2 backend   # NGINX least_conn naturally
                                                              # routes to healthy instances
```

NGINX's `least_conn` upstream strategy means traffic is never sent to an
instance that's still starting up, so requests in flight during a deploy are
never dropped.

## Database Migrations in Production

Migrations are plain SQL files in `database/migrations/`, applied in lexical
order. They are **idempotent-safe to re-run** via the tracking table created
by `database/scripts/run_migrations.sh`:

```bash
DATABASE_URL=$PROD_DATABASE_URL ./database/scripts/run_migrations.sh
```

This script records each applied migration in a `schema_migrations` table and
skips any that have already run — safe to execute on every deploy.

**Never edit an already-applied migration file.** If a schema change is
needed after a migration has shipped, write a new migration file instead.

## Backups

`infrastructure/scripts/postgres-backup.sh` runs nightly via cron (or as a
scheduled container) and:
1. Dumps the database with `pg_dump --format=custom --compress=9`
2. Uploads to S3 with server-side encryption
3. Verifies the dump's integrity with `pg_restore --list`
4. Prunes local backups older than 2 days and S3 backups older than 30 days

Set up the cron job on the host (outside Docker, since it needs `aws` CLI
and direct DB access):

```bash
0 2 * * * /opt/pgbooking/infrastructure/scripts/postgres-backup.sh >> /var/log/pgbooking-backup.log 2>&1
```

### Restoring from Backup

```bash
aws s3 cp s3://pgbooking-backups-prod/database-backups/pgbooking_prod_TIMESTAMP.sql.gz .
gunzip pgbooking_prod_TIMESTAMP.sql.gz
pg_restore --clean --if-exists -d $DATABASE_URL pgbooking_prod_TIMESTAMP.sql
```

## Monitoring

Prometheus scrapes `/metrics` on the backend every 15s. Alert rules in
`infrastructure/monitoring/prometheus/alerts.yml` cover API latency SLOs,
database connection pool exhaustion, Redis memory pressure, booking failure
rate, and disk space. Wire `alertmanagers` in `prometheus.yml` to your
preferred notification channel (Slack, PagerDuty, etc.) — left as static
empty targets in the default config since notification routing is
environment-specific.

## Rollback

If a bad deploy makes it to production:

```bash
# Roll back to the previous image tag
IMAGE_TAG=<previous-sha> docker compose -f docker-compose.prod.yml up -d --no-deps backend

# If the bad deploy included a migration, you may need to write a
# down-migration manually — this project does not auto-generate rollback SQL,
# by design, since destructive auto-rollbacks on a production financial
# database are riskier than a deliberate manual fix.
```

## Scaling Checklist

Before increasing `TARGET_REPLICAS` beyond 2:
- [ ] Confirm PostgreSQL `max_connections` accommodates `replicas × pool_size`
- [ ] Confirm Redis is not the bottleneck (check `redis-cli INFO memory`)
- [ ] Confirm NGINX `worker_connections` is sized for expected concurrent connections
- [ ] Load test with `tests/load/booking.load.ts` against staging first
