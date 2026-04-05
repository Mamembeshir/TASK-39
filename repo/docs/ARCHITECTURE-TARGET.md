# Architecture Target (Refactor Prep)

This file maps the current monolith behavior before structural refactors.

## HTTP Surface (Current)

Auth legend:

- `public`: no auth middleware
- `user`: `requireAuth`
- `customer`: `requireCustomer`
- `staff`: `requireRoles(STAFF_ROLES)` (`administrator`, `service_manager`)
- `moderation`: `requireRoles(MODERATOR_ROLES)` (`moderator`, `administrator`)
- `message_staff`: `requireRoles(MESSAGE_CREATOR_ROLES)` (`administrator`, `service_manager`, `moderator`)

| Method | Path | Auth as implemented |
| --- | --- | --- |
| GET | `/api/health` | public |
| POST | `/api/auth/register` | public |
| POST | `/api/auth/login` | public |
| POST | `/api/auth/refresh` | public |
| POST | `/api/auth/logout` | public (optional bearer used if present) |
| GET | `/api/auth/me` | user |
| PUT | `/api/profile/contact` | user |
| GET | `/api/profile/me` | user |
| POST | `/api/favorites/:serviceId` | customer |
| DELETE | `/api/favorites/:serviceId` | customer |
| GET | `/api/favorites` | customer |
| PUT | `/api/compare` | customer |
| GET | `/api/compare` | customer |
| POST | `/api/quote` | customer |
| POST | `/api/orders` | customer |
| GET | `/api/orders/:id` | user (plus owner/staff check in handler) |
| POST | `/api/orders/:id/cancel` | user (plus owner/staff check in handler) |
| POST | `/api/staff/orders/:id/complete` | staff |
| GET | `/api/services` | public |
| GET | `/api/search` | public |
| GET | `/api/services/:id` | public (unpublished hidden unless staff via bearer) |
| GET | `/api/services/:id/questions` | public |
| GET | `/api/services/:id/reviews` | public |
| POST | `/api/content` | staff |
| PATCH | `/api/content/:id/draft` | staff |
| POST | `/api/content/:id/schedule` | staff |
| POST | `/api/content/:id/publish` | staff |
| GET | `/api/content/:id/versions` | staff |
| POST | `/api/content/:id/rollback` | staff |
| POST | `/api/media` | user |
| GET | `/api/media/files/:id` | user (owner/staff object-level access check) |
| DELETE | `/api/media/:id` | user |
| GET | `/media/files/*` | public static assets only (`MEDIA_UPLOAD_DIR/public`) |
| POST | `/api/reviews` | customer |
| POST | `/api/moderation/reviews/:id/approve` | moderation |
| POST | `/api/moderation/reviews/:id/reject` | moderation |
| POST | `/api/tickets` | user (customer ownership/staff override in handler) |
| GET | `/api/tickets/:id` | user (owner/staff check in handler) |
| POST | `/api/tickets/:id/status` | user (owner/staff check + role/state transition policy in handler) |
| POST | `/api/tickets/:id/legal-hold` | staff |
| POST | `/api/tickets/:id/resolve` | staff |
| POST | `/api/staff/messages` | message_staff |
| GET | `/api/inbox` | user |
| POST | `/api/inbox/:id/read` | user |
| POST | `/api/staff/services` | staff |
| PATCH | `/api/staff/services/:id` | staff |
| POST | `/api/staff/services/:id/publish` | staff |
| POST | `/api/staff/services/:id/unpublish` | staff |
| POST | `/api/staff/bundles` | staff |
| PATCH | `/api/staff/bundles/:id` | staff |
| POST | `/api/staff/bundles/:id/publish` | staff |
| POST | `/api/staff/bundles/:id/unpublish` | staff |
| GET | `/api/internal/seed-check` | disabled by default; only available in `NODE_ENV=test` and requires admin auth + `X-Internal-Token` |
| POST | `/api/internal/test-fixtures/booking-slot` | disabled by default; only available in `NODE_ENV=test` and requires admin auth + `X-Internal-Token` |
| POST | `/api/internal/test-fixtures/completed-order` | disabled by default; only available in `NODE_ENV=test` and requires admin auth + `X-Internal-Token` |
| POST | `/api/internal/test-fixtures/blacklist-ip` | disabled by default; only available in `NODE_ENV=test` and requires admin auth + `X-Internal-Token` |
| POST | `/api/internal/constraints/users-username` | disabled by default; only available in `NODE_ENV=test` and requires admin auth + `X-Internal-Token` |

## Mongo Collections and Module Touch Map

Primary modules:

- `backend/src/app.js` (HTTP handlers + middleware)
- `backend/src/db.js` (index creation + seed/bootstrap)
- `backend/src/scripts/searchCleanup.js`
- `backend/src/scripts/retentionCleanup.js`

| Collection | Touched by modules |
| --- | --- |
| `users` | `app.js`, `db.js` |
| `login_attempts` | `app.js`, `services/auth/authService.js`, `repositories/usersRepository.js` |
| `refresh_tokens` | `app.js`, `db.js`, `services/auth/authService.js`, `repositories/usersRepository.js` |
| `user_devices` | `app.js`, `db.js` |
| `services` | `app.js`, `db.js`, `searchCleanup.js` |
| `bundles` | `app.js`, `db.js` |
| `service_questions` | `app.js`, `db.js` |
| `favorites` | `app.js`, `db.js` |
| `compare_lists` | `app.js`, `db.js` |
| `capacity_slots` | `app.js`, `db.js` |
| `orders` | `app.js`, `db.js` |
| `reviews` | `app.js`, `db.js`, `retentionCleanup.js` |
| `tickets` | `app.js`, `db.js`, `retentionCleanup.js` |
| `messages` | `app.js`, `db.js` |
| `content_versions` | `app.js`, `db.js`, `searchCleanup.js`, `retentionCleanup.js` |
| `media_metadata` | `app.js`, `db.js`, `retentionCleanup.js` |
| `audit_logs` | `app.js`, `db.js` |
| `settings` | `app.js`, `db.js` |
| `jurisdictions` | `app.js`, `db.js` |
| `travel_zones` | `db.js` |
| `search_documents` | `app.js`, `db.js`, `searchCleanup.js` |
| `blacklists` | `app.js`, `db.js` |

## R5 OLA Delta

Object-level authorization strategy is now explicit and centralized via `services/authorization/ownershipService.js`.

Leak-minimization policy for ownership checks:

- For ownership-protected resources, responses use `404` when resource is missing **or not owned/accessible**.
- Invalid ObjectId format remains `400`.

Actor/resource matrix:

- **Orders**
  - `customer`: only orders where `order.customerId == actor.userId`
  - `service_manager` and `administrator`: allowed
  - `moderator`: denied (404)
- **Tickets**
  - `customer`: only tickets where `ticket.customerId == actor.userId`
  - `service_manager` and `administrator`: allowed
  - `moderator`: denied unless route policy explicitly grants moderation route access
- **Review submission**
  - `customer`: only for own order (`order.customerId == actor.userId`)
  - Other users: denied by route policy and ownership check
