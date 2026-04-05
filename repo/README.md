# HomeCareOps

## Implementation Overview

HomeCareOps delivers end-to-end home-services operations for customers, moderators, service managers, and administrators:

- Customer flows: catalog browse/filter, compare, quote, checkout, orders, tickets, reviews, favorites.
- Staff and trust flows: moderation queues (reviews/Q&A), ticket dispute actions, legal-hold controls.
- Ops/admin flows: catalog/content operations, audit visibility, blacklist controls.
- Security and reliability controls: role/ownership authorization, runtime schedulers (content publish, retention cleanup, search cleanup), and HTTPS-by-default API transport.

## Run The App

### Docker

Generate local TLS certs first (required by default compose profile):

```bash
mkdir -p certs
openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 365 \
  -keyout certs/localhost.key \
  -out certs/localhost.crt \
  -subj "/CN=localhost"
```

```bash
docker compose up --build
```

App URLs:

- Frontend: `http://localhost:5173`
- API: `https://localhost:4000`

Fixture seeding is opt-in. By default, startup does not seed demo users/data.

### Run Without Docker

Backend:

```bash
cd backend
npm install
cp .env.example .env
npm start
```

Required backend env vars for local non-Docker runs are documented in `backend/.env.example` (notably `MONGO_URI`, `FIELD_ENCRYPTION_KEY`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`).
`backend/.env.example` defaults to HTTPS; generate `certs/localhost.key` and `certs/localhost.crt` before starting.
JWT secrets are required in all non-test environments, and startup rejects known placeholder values.

Pricing behavior notes:

- Same-day surcharge is explicit: select `sameDayPriority` to apply the $25 surcharge when slot start is within 4 hours.
- Sales tax has an explicit `taxEnabled` toggle; disabling is blocked when the selected jurisdiction requires tax.

Frontend:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Frontend non-Docker env requirements are documented in `frontend/.env.example` (notably `VITE_API_BASE_URL`).

## LAN TLS

TLS behavior:

- Canonical model: API always serves HTTPS directly (`https://localhost:4000`).
- Frontend dev server may stay HTTP (`http://localhost:5173`) but must call the API over HTTPS.
- `nginx/nginx.conf` follows the same model (`/api` proxied to `https://api:4000`).
- Set `TLS_ENABLED=false` only for explicitly trusted local-only workflows (for example isolated test runners).

Generate a local self-signed certificate:

```bash
mkdir -p certs
openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 365 \
  -keyout certs/localhost.key \
  -out certs/localhost.crt \
  -subj "/CN=localhost"
```

Run backend with HTTPS enabled (default):

```bash
cd backend
TLS_KEY_PATH=../certs/localhost.key \
TLS_CERT_PATH=../certs/localhost.crt \
npm start
```

The API listens on `https://localhost:4000` by default when TLS cert paths are configured.

## Search Cleanup Scheduling

The backend includes a built-in weekly search cleanup scheduler (enabled by default):

- `SEARCH_CLEANUP_SCHEDULER_ENABLED=true|false` (default: `true`)
- `SEARCH_CLEANUP_INTERVAL_MS=<milliseconds>` (default: one week)

You can still run cleanup manually:

```bash
cd backend
npm run search:cleanup
```

## Content Publish Scheduling

Scheduled content is auto-promoted by a background scheduler (enabled by default):

- `CONTENT_PUBLISH_SCHEDULER_ENABLED=true|false` (default: `true`)
- `CONTENT_PUBLISH_SCHEDULER_INTERVAL_MS=<milliseconds>` (default: `15000`)
- `CONTENT_PUBLISH_SCHEDULER_BATCH_SIZE=<count>` (default: `25`)

## Retention Cleanup Scheduling

Ticket attachment retention cleanup is also scheduled in app runtime (enabled by default):

- `RETENTION_CLEANUP_SCHEDULER_ENABLED=true|false` (default: `true`)
- `RETENTION_CLEANUP_INTERVAL_MS=<milliseconds>` (default: one day)
- `RETENTION_CLEANUP_DAYS=<days>` (default: `365`)

Manual cleanup remains available:

```bash
cd backend
npm run retention:cleanup
```

## Proxy Header Trust

Client IP attribution ignores `X-Forwarded-For` by default to prevent spoofing:

- `TRUST_PROXY_HEADERS=true|false` (default: `false`)

Enable it only when the API is behind a trusted reverse proxy that sanitizes forwarded headers.

## Internal Fixture Routes

Internal fixture endpoints are disabled by default and heavily restricted when enabled:

- `INTERNAL_ROUTES_ENABLED=true|false` (default: `false`)
- `INTERNAL_ROUTES_TOKEN=<shared-secret>` (required when enabled)

When enabled, internal routes:

- are allowed only with `NODE_ENV=test`
- require administrator authentication
- require `X-Internal-Token: <shared-secret>`

## Seed Fixtures

Demo fixtures are opt-in and disabled by default:

- `SEED_FIXTURES=true` enables seeded demo users/data (intended for automated tests and local-only development)
- `SEED_FIXTURES=false` keeps startup free of demo credentials (default)

Security rules:

- Production startup hard-fails if `SEED_FIXTURES=true`
- Do not enable fixture seeding in shared or internet-exposed environments

Recommended paths by environment:

- Local development: keep `SEED_FIXTURES=false` unless you explicitly need demo fixture data.
- Test/integration runs: enable fixtures explicitly (`SEED_FIXTURES=true`), as done by `run_tests.sh`.

For explicit fixture loading (without relying on startup flag), run:

```bash
cd backend
npm run seed:fixtures
```

## Architecture Snapshot

- Backend: Express + MongoDB with layered controllers/services/repositories and centralized middleware for auth, validation, and errors.
- Frontend: React + route-based feature modules with API clients and shared UI primitives.
- Runtime workers: slot release, search cleanup, scheduled content publishing, and retention cleanup.
- Compose topology: MongoDB, API, frontend, and test-runner containers for reproducible local integration tests.

## Packaging and Artifact Hygiene

To keep product attachments deterministic and safe:

- Environment-dependent directories are excluded (`node_modules`, `.venv`, `bin`, `obj`, etc.).
- Local cache/tooling state is excluded (`.opencode`, `.codex`, `.vscode`, `__pycache__`, `.pytest_cache`, and related caches).
- Local database artifacts/dumps are excluded (`*.db`, `*.sqlite*`, `*.sql`, `dump/`, `mongo-data/`).
- Database initialization dependencies are script-driven (`backend/src/scripts/*`) and no runtime database files are packaged.

## Media Delivery Model

Media is stored on local disk and served with an explicit split model:

- Public assets/content media: served by Express static middleware from `MEDIA_UPLOAD_DIR/public` at `/media/files/*`.
- Sensitive user evidence (ticket/review/private uploads): served through authenticated object-checked endpoint `/api/media/files/:id`.

This keeps prompt fidelity for local-disk static serving while preserving access control for sensitive attachments.
