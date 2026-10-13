# NextGen PG & Room Booking Ecosystem

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile | React Native 0.74 + TypeScript |
| Backend | Node.js 20 + Express + TypeScript |
| Database | PostgreSQL 16 + PostGIS 3.4 |
| Cache / Locks | Redis 7 |
| Queue | BullMQ |
| Storage | AWS S3 |
| Payments | Razorpay |
| Auth | Phone OTP + JWT RS256 |
| Infrastructure | Docker + GitHub Actions + Nginx |

---

## Quick Start (Local Dev)

```bash
# 1. Clone and install
git clone https://github.com/your-org/pgbooking.git && cd pgbooking

# 2. Start infrastructure
docker compose up -d postgres redis

# 3. Setup backend
cd apps/backend
cp .env.example .env.development
npm install
npm run keys:generate          # Generate RS256 JWT key pair
npm run migrate:up             # Apply all migrations (calls database/scripts/run_migrations.sh)
npm run seed                   # Load dev seed data
npm run dev                    # Start backend on :3000

# 4. Setup mobile (separate terminal)
cd apps/mobile
npm install
npx pod-install ios            # iOS only
npm run ios                    # or: npm run android
```

### Full stack with Docker
```bash
docker compose --profile tools up -d   # includes pgAdmin + LocalStack
```

---

## Project Structure

```
pgbooking/
├── apps/
│   ├── backend/                 # Node.js + Express API
│   │   ├── src/
│   │   │   ├── config/          # DB, Redis, AWS, Razorpay config
│   │   │   ├── domains/         # Domain modules (auth, bookings, payments…)
│   │   │   ├── shared/          # Middleware, utils, types, errors
│   │   │   └── infrastructure/  # Queue workers, S3, SMS, email, push
│   │   └── tests/               # Unit, integration, load tests
│   └── mobile/                  # React Native app
│       └── src/
│           ├── screens/         # All UI screens
│           ├── navigation/      # React Navigation setup
│           ├── store/           # Redux Toolkit state
│           ├── api/             # Axios services
│           └── theme/           # Design tokens
├── database/
│   └── migrations/              # 001–008 ordered SQL migrations
├── infrastructure/
│   ├── docker/                  # Nginx config, Redis config
│   ├── github/workflows/        # CI/CD pipeline
│   ├── monitoring/              # Prometheus + Grafana
│   └── scripts/                 # Deploy, backup scripts
└── docker-compose.yml           # Dev environment
```

---

## Architecture Decisions

| Decision | Choice | Reason |
|---|---|---|
| API pattern | Micro-monolith | Single team, 8-week timeline; extractable to microservices later |
| JWT algorithm | RS256 (asymmetric) | Public key can be shared with third-party validators |
| Access token TTL | 15 minutes | Balance between security and UX (SRS said 24h — too long) |
| OTP | 6-digit CSPRNG, SHA-256 hashed in DB | Never store plaintext OTP |
| Booking lock | Redis NX + DB FOR UPDATE | Two-stage: Redis prevents concurrent DB hits; FOR UPDATE prevents race at DB level |
| Bed counter | DB trigger → denormalized on property | Avoids COUNT(*) on every search query |
| Token deposit | 20% of security deposit (computed column) | Enforced in DB, not just application layer |
| Refresh tokens | Family-based rotation | Reuse detection: revoke entire family on suspicious replay |

---

## API Reference

Base URL: `https://api.pgbooking.in/api/v1`

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/otp/send` | Send OTP to phone number |
| `POST` | `/auth/otp/verify` | Verify OTP, issue token pair |
| `POST` | `/auth/token/refresh` | Rotate refresh token |
| `POST` | `/auth/logout` | Revoke all tokens |
| `GET` | `/auth/me` | Get current user |
| `PATCH` | `/auth/profile` | Complete profile |

### Properties
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/properties/search?lat=&lng=&radius_km=` | PostGIS radius search |
| `GET` | `/properties/:id` | Property detail with photos |
| `POST` | `/properties` | Create property (OWNER) |
| `PUT` | `/properties/:id` | Update property |
| `POST` | `/properties/:id/photos` | Upload property photos |
| `POST` | `/properties/:id/favorites` | Toggle favorite |

### Bookings
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/bookings` | Initiate booking (acquires Redis lock) |
| `GET` | `/bookings/mine` | Tenant's bookings |
| `GET` | `/bookings/:id` | Booking detail |
| `POST` | `/bookings/:id/cancel` | Cancel booking |
| `POST` | `/bookings/:id/checkout` | Owner checks out tenant |

### Payments
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/payments/orders` | Create Razorpay order |
| `POST` | `/payments/verify` | Verify payment signature |
| `GET` | `/payments/mine` | Payment history |
| `POST` | `/payments/webhook/razorpay` | Razorpay webhook (HMAC verified) |

---

## Running Tests

```bash
cd apps/backend

# Unit tests (no external dependencies)
npm run test:unit

# Integration tests (requires postgres + redis)
docker compose up -d postgres redis
npm run test:integration

# Race condition tests specifically
SKIP_INTEGRATION=false npx jest tests/integration/api/booking.race.test.ts

# Load tests (requires k6)
k6 run tests/load/booking.load.ts
```

---

## Production Deployment

```bash
# 1. Set secrets in GitHub Actions (Settings → Secrets)
#    PROD_HOST, PROD_USER, PROD_SSH_KEY
#    SLACK_WEBHOOK_URL

# 2. Push to staging branch → auto-deploys to staging
git push origin staging

# 3. Push to main → auto-deploys to production (with approval gate)
git push origin main

# Manual deploy
./infrastructure/scripts/deploy.sh production latest
```

---

## Production Readiness Checklist

### Security
- [x] TLS 1.3 enforced at Nginx (HTTP redirects to HTTPS)
- [x] JWT RS256 with 15-minute access tokens + 7-day rotating refresh tokens
- [x] Refresh token reuse detection (family revocation)
- [x] OTP: SHA-256 hashed, 5-min TTL, 3-attempt lockout, resend cooldown
- [x] Rate limiting: Redis-backed sliding window on all endpoints
- [x] Helmet security headers (CSP, HSTS, X-Frame-Options)
- [x] Input validation: Zod schemas on all request bodies/params/query
- [x] SQL injection prevention: parameterized queries throughout
- [x] AES-256-GCM encryption for sensitive data at rest
- [x] S3 private buckets with signed URL access only
- [x] Razorpay webhook HMAC-SHA256 signature verification
- [x] Audit log table for all write operations
- [x] CORS whitelist

### Data Integrity
- [x] Double-booking: Redis NX lock + PostgreSQL SELECT FOR UPDATE
- [x] Idempotency keys on bookings and payments
- [x] Token deposit = 20% security deposit (computed column in DB)
- [x] Soft deletes on all user-facing entities
- [x] Bed counter denormalization via triggers (no COUNT(*) in search)
- [x] Financial amounts: NUMERIC(12,2) — no floating point
- [x] 3NF compliance across all tables

### Availability & Performance
- [x] Health check endpoint at /health
- [x] Graceful shutdown (SIGTERM/SIGINT handlers)
- [x] PostgreSQL connection pooling (pg-pool)
- [x] Redis connection retry with exponential backoff
- [x] BullMQ workers with retry + dead-letter queue
- [x] PostGIS GiST spatial index for sub-200ms search
- [x] Prometheus metrics + Grafana dashboards
- [x] Alert rules for SLO breaches
- [x] Automated daily PostgreSQL backups to S3
- [x] 30-day backup retention policy

### Observability
- [x] Structured JSON logging (Winston + daily rotate)
- [x] Request ID propagation (X-Request-ID header)
- [x] Morgan HTTP access logs
- [x] Slow query logging (>1000ms)
- [x] BullMQ job failure tracking

### CI/CD
- [x] GitHub Actions: lint → unit tests → integration tests → build → deploy
- [x] Docker multi-stage build (builder + minimal runtime)
- [x] Zero-downtime rolling deploy (scale to 2, health check, scale back)
- [x] Automatic rollback on failed health check
- [x] Slack deploy notifications
- [x] Image caching with GitHub Actions cache
- [x] Multi-arch builds (amd64 + arm64)
