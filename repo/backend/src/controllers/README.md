# Controllers Layer

Controllers are thin HTTP adapters between Express routes and service modules.

## Responsibilities

- Parse route params/query/body into validated inputs.
- Invoke service methods with explicit dependencies.
- Map service outputs to stable HTTP response shapes.
- Forward typed application errors to centralized error middleware.

## Current controllers

- `authController`, `customerController`, `ordersController`, `ticketsController`, `reviewsController`
- `catalogController`, `contentController`, `mediaController`, `inboxController`, `adminController`
- `internalController` (test-only fixture routes, gated by env + auth + shared token)

## Rules

- Keep business logic in services; controllers should not reimplement domain policy.
- Do not access database collections directly in controllers except legacy compatibility paths that are intentionally isolated.
- Keep controller methods deterministic and easy to unit/integration test by using dependency injection.

## Wiring

- Controllers are instantiated centrally in `backend/src/bootstrap/registerRoutes.js`.
