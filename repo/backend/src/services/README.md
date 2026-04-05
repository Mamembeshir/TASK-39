# Services Layer

Service modules implement business logic and orchestrate repository access.

## Responsibilities

- Enforce domain invariants (pricing, slot-service compatibility, ownership checks, status transitions).
- Perform authorization-sensitive business checks beyond route guards.
- Coordinate side effects (audit writes, search sync, scheduler-triggered workflows).
- Return normalized result objects for controllers to translate into HTTP responses.

## Current service groups

- `auth/`: login, token lifecycle, rate-limiting policy, JWT secret resolution.
- `authorization/`: ownership and access assertions shared across domains.
- `catalog/`, `content/`, `search/`: customer catalog, Q&A moderation, content publish/search sync.
- `orders/`, `quote/`, `tickets/`, `reviews/`, `inbox/`, `media/`: core customer/staff operations.
- `audit/`: structured forensic event logging.

## Dependency boundaries

- Services depend on repositories and pure utility modules.
- Services must not read Express request/response directly unless an explicit request context is passed for audit metadata.
- Services should avoid direct database access when a repository already exists for that domain.

## Composition

- Services are composed in `backend/src/app.core.js` and wired into route/controllers via `backend/src/bootstrap/registerRoutes.js`.
