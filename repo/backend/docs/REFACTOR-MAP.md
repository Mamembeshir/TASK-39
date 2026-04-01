# Refactor Map

## Phase 0 Baseline

- Contract gate command: `docker compose exec api sh -c "API_BASE_URL=http://localhost:4000 API_HTTPS_BASE_URL=https://proxy ./run_tests.sh"`
- Baseline result: `TOTAL: 37, PASSED: 37, FAILED: 0` (exit code `0`)
- Baseline log snapshot: `test-baseline.txt` at repo root
- `wc -l backend/src/app.js` (before extraction step): `3140`
- Approximate route declarations (`app.METHOD(...)`): `55`

## Domain Extraction Plan

| Domain | Current file(s) | Target folders | Status |
| --- | --- | --- | --- |
| App bootstrap | `src/app.js` | `src/app.js`, `src/server.js` | In progress (bootstrap wrapper done) |
| Auth | `src/app.core.js` + `services/auth` + `repositories/usersRepository.js` | `routes/auth.routes.js`, `controllers/authController.js`, `services/auth`, `repositories/usersRepository.js` | In progress |
| Catalog/search | `src/app.core.js`, `src/pricing.js` | `routes/catalog.routes.js`, `controllers/catalogController.js`, `services/catalog/*`, `repositories/catalogRepository.js` | In progress |
| Favorites/compare | `src/app.core.js` | `routes/customer.routes.js`, `controllers/customerController.js`, `services/favorites/*`, `repositories/favoritesRepository.js` | In progress |
| Quotes | `src/app.core.js`, `src/pricing.js` | `routes/customer.routes.js`, `controllers/customerController.js`, `services/quote/quoteService.js`, `repositories/quoteRepository.js` | In progress |
| Orders/slots | `src/app.core.js`, `services/authorization/ownershipService.js` | `routes/orders.routes.js`, `controllers/ordersController.js`, `services/orders/*`, `repositories/ordersRepository.js` | In progress |
| Reviews/moderation | `src/app.core.js` | `routes/reviews.routes.js`, `controllers/reviewsController.js`, `services/reviews/*`, `repositories/reviewsRepository.js` | In progress |
| Media | `src/app.core.js`, `src/security.js` | `routes/media.routes.js`, `controllers/mediaController.js`, `services/media/*`, `repositories/mediaRepository.js` | In progress |
| Tickets/SLA | `src/app.core.js`, `src/sla.js` | `routes/tickets.routes.js`, `controllers/ticketsController.js`, `services/tickets/*`, `repositories/ticketsRepository.js` | In progress |
| Content/versioning | `src/app.core.js` | `routes/content.routes.js`, `controllers/contentController.js`, `services/content/*`, `repositories/contentRepository.js` | In progress |
| Inbox/messages | `src/app.core.js` | `routes/inbox.routes.js`, `controllers/inboxController.js`, `services/inbox/*`, `repositories/inboxRepository.js` | In progress |
| Internal fixtures | `src/app.core.js` | `routes/internal.routes.js`, `controllers/internalController.js`, `services/internal/*` | In progress |

## Security Invariants During Refactor

- Keep centralized auth verification in one place (`services/auth` + `middleware/authenticate`).
- Keep route policy enforcement in one place (`config/routePolicies.js` + middleware).
- Keep OLA checks centralized (`services/authorization/ownershipService.js`) and called from service/controller boundaries.
- Keep validation and error shape intact (`VALIDATION_ERROR`, AppError mapping).

## Current Blockers / Notes

- `src/app.core.js` is still a large transitional file containing many route handlers and business rules.
- Existing tests are sensitive to current HTTP behavior and seeded fixtures; extraction must be incremental to avoid contract drift.
- Next extraction slice should move one domain at a time (Auth -> Orders/Tickets -> Catalog -> Content/Inbox) with tests run after each slice.

## Latest Slice (Current Pass)

- Extracted auth routes/controller into dedicated modules and mounted via `app.use("/api/auth", ...)`.
- Extracted orders routes/controller into dedicated modules and mounted under `/api/orders` and `/api/staff/orders`.
- Extracted profile/favorites/compare/quote handlers into `controllers/customerController.js` + `routes/customer.routes.js`.
- Extracted tickets + inbox/messages handlers into `controllers/ticketsController.js`, `controllers/inboxController.js` and `routes/tickets.routes.js`, `routes/inbox.routes.js`.
- Extracted catalog/search + staff catalog handlers into `controllers/catalogController.js` and `routes/catalog.routes.js`.
- Extracted content/versioning handlers into `controllers/contentController.js` and `routes/content.routes.js`.
- Extracted media handlers into `controllers/mediaController.js` and `routes/media.routes.js`.
- Extracted reviews/moderation handlers into `controllers/reviewsController.js` and `routes/reviews.routes.js`.
- Extracted internal fixture/constraint handlers into `controllers/internalController.js` and `routes/internal.routes.js`.
- Moved shared business logic into dedicated services (`services/quote`, `services/orders`, `services/search`, `services/media`, `services/catalog`, `services/inbox`, `services/moderation`, `services/audit`, `services/auth/deviceFingerprintService.js`).
- Extracted blacklist enforcement into dedicated middleware (`middleware/enforceBlacklist.js`).
- Reduced `app.core.js` to composition/wiring plus minimal transitional helpers.
- Added first domain repositories + domain services for Orders, Tickets, Inbox, Catalog, Content, Media, and Reviews (`repositories/ordersRepository.js`, `repositories/ticketsRepository.js`, `repositories/messagesRepository.js`, `repositories/catalogRepository.js`, `repositories/contentRepository.js`, `repositories/mediaRepository.js`, `repositories/reviewsRepository.js`, `services/orders/ordersService.js`, `services/tickets/ticketsService.js`, `services/inbox/inboxService.js`, `services/catalog/catalogService.js`, `services/content/contentService.js`, `services/media/mediaService.js`, `services/reviews/reviewsService.js`) and updated controllers to delegate business/data logic.
- Quality gates after extraction pass:
  - `npm run lint` (pass)
  - `npm run format:check` (pass)
  - contract suite via API container: `TOTAL: 37, PASSED: 37, FAILED: 0`

## Security Audit Snapshot

- JWT verification location: centralized in `services/auth/authService.js`.
- Route policy source: `config/routePolicies.js` with middleware enforcement.
- OLA source: `services/authorization/ownershipService.js` used by order/ticket/review ownership flows.
- Repository hygiene: dedicated `repositories/usersRepository.js` is explicit-field only; additional domain repositories pending extraction.

No new auth/authorization gap was found in this pass.

## Largest Files (Current)

Measured with `wc -l`:

1. `backend/src/db.js` — 648 lines (seed/index bootstrap; split planned)
2. `backend/src/app.core.js` — 563 lines (now mostly composition; remaining health/bootstrap glue)
3. `backend/src/pricing.js` — 260 lines
4. `backend/src/services/auth/authService.js` — under 260 lines
5. `backend/src/app.js` — 6 lines

Route declaration count in `app.core.js` is currently ~1 direct `app.METHOD(...)` handler (down from ~55 baseline).
