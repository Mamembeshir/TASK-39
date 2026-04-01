# HomeCareOps

## Run The App

### Docker

```bash
docker compose up --build
```

App URLs:

- Frontend: `http://localhost:5173`
- API: `http://localhost:4000`

The API seeds the database automatically on startup.

### Run Without Docker

Backend:

```bash
cd backend
npm install
npm start
```

In production, set `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` explicitly; startup fails if they are missing.

Pricing behavior notes:

- Same-day surcharge is explicit: select `sameDayPriority` to apply the $25 surcharge when slot start is within 4 hours.
- Sales tax has an explicit `taxEnabled` toggle; disabling is blocked when the selected jurisdiction requires tax.

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## LAN TLS (Optional)

TLS behavior:

- Production default (`NODE_ENV=production`): TLS is required unless `TLS_ENABLED=false` is explicitly set.
- Development/test default: HTTP unless `TLS_ENABLED=true` is set.

Generate a local self-signed certificate:

```bash
mkdir -p certs
openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 365 \
  -keyout certs/lan-key.pem \
  -out certs/lan-cert.pem \
  -subj "/CN=localhost"
```

Run backend with HTTPS enabled:

```bash
cd backend
TLS_ENABLED=true \
TLS_KEY_PATH=../certs/lan-key.pem \
TLS_CERT_PATH=../certs/lan-cert.pem \
npm start
```

The API will listen on `https://localhost:4000` when TLS is enabled.

## Search Cleanup Scheduling

The backend includes a built-in weekly search cleanup scheduler (enabled by default):

- `SEARCH_CLEANUP_SCHEDULER_ENABLED=true|false` (default: `true`)
- `SEARCH_CLEANUP_INTERVAL_MS=<milliseconds>` (default: one week)

You can still run cleanup manually:

```bash
cd backend
npm run search:cleanup
```

## Seeded Accounts

All seeded accounts use the same password:

```text
devpass123456
```

These seeded credentials are development fixtures only.

Accounts:

| Username | Role | Password |
| --- | --- | --- |
| `customer_demo` | `customer` | `devpass123456` |
| `admin_demo` | `administrator` | `devpass123456` |
| `manager_demo` | `service_manager` | `devpass123456` |
| `moderator_demo` | `moderator` | `devpass123456` |
