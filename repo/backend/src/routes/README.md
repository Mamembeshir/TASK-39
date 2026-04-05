# Routes Layer

Route modules define HTTP surface area and middleware composition.

## Responsibilities

- Attach auth/role middleware before controller handlers.
- Keep endpoint-level guard policy close to route definitions.
- Expose grouped routers by domain (`auth`, `orders`, `tickets`, `catalog`, etc.).

## Current structure

- Public/customer routers: auth, catalog/content read paths, quote/favorites/compare, orders, tickets, reviews, media, inbox.
- Staff/admin routers: moderation, staff orders/messages/catalog, admin audit/blacklist.
- Internal fixtures router: mounted only when explicitly enabled and only in `NODE_ENV=test`.

## Security boundary notes

- `/api/internal/*` is disabled by default and, when enabled, requires:
  - test environment
  - authenticated administrator
  - `X-Internal-Token` shared secret
- Route policy metadata is documented in `backend/src/config/routePolicies.js` and enforced by shared authorization middleware.

## Registration

- All routers are mounted from `backend/src/bootstrap/registerRoutes.js` to keep path ownership and dependencies centralized.
