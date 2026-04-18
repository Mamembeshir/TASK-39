# Test Coverage Audit

## Project Type Detection

- README explicitly declares project type: `Project Type: Fullstack Web Application` (`README.md:3`).
- Project type used for strict audit: **fullstack**.

## Backend Endpoint Inventory

Resolved from route declarations + mount prefixes in `backend/src/bootstrap/registerRoutes.js:24` and `backend/src/app.core.js:284`.

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `PUT /api/profile/contact`
- `GET /api/profile/me`
- `POST /api/favorites/:serviceId`
- `DELETE /api/favorites/:serviceId`
- `GET /api/favorites`
- `PUT /api/compare`
- `GET /api/compare`
- `GET /api/quote/jurisdictions`
- `GET /api/quote/slots`
- `POST /api/quote`
- `POST /api/orders`
- `GET /api/orders`
- `GET /api/orders/:id`
- `POST /api/orders/:id/cancel`
- `GET /api/staff/orders/slots`
- `POST /api/staff/orders/slots`
- `POST /api/staff/orders/slots/:id`
- `DELETE /api/staff/orders/slots/:id`
- `POST /api/staff/orders/:id/complete`
- `GET /api/admin/audit`
- `GET /api/admin/blacklist`
- `POST /api/admin/blacklist`
- `GET /api/services`
- `GET /api/search`
- `GET /api/services/:id`
- `GET /api/services/:id/questions`
- `POST /api/services/:id/questions`
- `GET /api/services/:id/reviews`
- `GET /api/moderation/questions`
- `POST /api/moderation/questions/:id/publish`
- `POST /api/moderation/questions/:id/reject`
- `POST /api/staff/services`
- `PATCH /api/staff/services/:id`
- `POST /api/staff/services/:id/publish`
- `POST /api/staff/services/:id/unpublish`
- `POST /api/staff/bundles`
- `PATCH /api/staff/bundles/:id`
- `POST /api/staff/bundles/:id/publish`
- `POST /api/staff/bundles/:id/unpublish`
- `GET /api/content/manage`
- `GET /api/content`
- `GET /api/content/:id`
- `POST /api/content`
- `PATCH /api/content/:id/draft`
- `POST /api/content/:id/schedule`
- `POST /api/content/:id/publish`
- `GET /api/content/:id/versions`
- `POST /api/content/:id/rollback`
- `POST /api/media`
- `GET /api/media/files/:id`
- `DELETE /api/media/:id`
- `POST /api/reviews`
- `GET /api/moderation/reviews`
- `POST /api/moderation/reviews/:id/approve`
- `POST /api/moderation/reviews/:id/reject`
- `POST /api/tickets`
- `GET /api/tickets`
- `GET /api/tickets/:id`
- `POST /api/tickets/:id/status`
- `POST /api/tickets/:id/legal-hold`
- `POST /api/tickets/:id/resolve`
- `POST /api/staff/messages`
- `GET /api/inbox`
- `POST /api/inbox/:id/read`
- `GET /api/internal/seed-check` *(conditionally mounted only when `INTERNAL_ROUTES_ENABLED=true` and `NODE_ENV=test` per `backend/src/bootstrap/registerRoutes.js:282`)*
- `POST /api/internal/test-fixtures/booking-slot` *(conditional)*
- `POST /api/internal/test-fixtures/completed-order` *(conditional)*
- `POST /api/internal/test-fixtures/blacklist-ip` *(conditional)*
- `POST /api/internal/constraints/users-username` *(conditional)*

Total endpoints: **75**

## API Test Mapping Table

| Endpoint | Covered | Test type | Test files | Evidence |
|---|---|---|---|---|
| GET `/api/health` | yes | true no-mock HTTP | `backend/tests/api/admin_blacklist_upsert_test.sh` | route `backend/src/app.core.js:app.get("/api/health")`; curl in `backend/tests/api/admin_blacklist_upsert_test.sh` |
| POST `/api/auth/register` | yes | true no-mock HTTP | `backend/tests/api/auth_lockout_test.sh` | route `backend/src/routes/auth.routes.js:createAuthRouter`; curl in `backend/tests/api/auth_lockout_test.sh` |
| POST `/api/auth/login` | yes | true no-mock HTTP | `backend/tests/api/admin_audit_risk_test.sh` | route `backend/src/routes/auth.routes.js:createAuthRouter`; curl in `backend/tests/api/admin_audit_risk_test.sh` |
| POST `/api/auth/refresh` | yes | true no-mock HTTP | `backend/tests/api/auth_refresh_test.sh` | route `backend/src/routes/auth.routes.js:createAuthRouter`; curl in `backend/tests/api/auth_refresh_test.sh` |
| POST `/api/auth/logout` | yes | true no-mock HTTP | `backend/tests/api/auth_logout_test.sh` | route `backend/src/routes/auth.routes.js:createAuthRouter`; curl in `backend/tests/api/auth_logout_test.sh` |
| GET `/api/auth/me` | yes | true no-mock HTTP | `backend/tests/api/auth_missing_token_401_test.sh` | route `backend/src/routes/auth.routes.js:createAuthRouter`; curl in `backend/tests/api/auth_missing_token_401_test.sh` |
| PUT `/api/profile/contact` | yes | true no-mock HTTP | `backend/tests/api/masking_profile_order_test.sh` | route `backend/src/routes/customer.routes.js:createProfileRouter`; curl in `backend/tests/api/masking_profile_order_test.sh` |
| GET `/api/profile/me` | yes | true no-mock HTTP | `backend/tests/api/masking_profile_order_test.sh` | route `backend/src/routes/customer.routes.js:createProfileRouter`; curl in `backend/tests/api/masking_profile_order_test.sh` |
| POST `/api/favorites/:serviceId` | yes | true no-mock HTTP | `backend/tests/api/favorites_compare_requirement_test.sh` | route `backend/src/routes/customer.routes.js:createFavoritesRouter`; curl in `backend/tests/api/favorites_compare_requirement_test.sh` |
| DELETE `/api/favorites/:serviceId` | yes | true no-mock HTTP | `backend/tests/api/favorites_compare_requirement_test.sh` | route `backend/src/routes/customer.routes.js:createFavoritesRouter`; curl in `backend/tests/api/favorites_compare_requirement_test.sh` |
| GET `/api/favorites` | yes | true no-mock HTTP | `backend/tests/api/favorites_compare_requirement_test.sh` | route `backend/src/routes/customer.routes.js:createFavoritesRouter`; curl in `backend/tests/api/favorites_compare_requirement_test.sh` |
| PUT `/api/compare` | yes | true no-mock HTTP | `backend/tests/api/compare_limit_test.sh` | route `backend/src/routes/customer.routes.js:createCompareRouter`; curl in `backend/tests/api/compare_limit_test.sh` |
| GET `/api/compare` | yes | true no-mock HTTP | `backend/tests/api/favorites_compare_requirement_test.sh` | route `backend/src/routes/customer.routes.js:createCompareRouter`; curl in `backend/tests/api/favorites_compare_requirement_test.sh` |
| GET `/api/quote/jurisdictions` | yes | true no-mock HTTP | `backend/tests/api/quote_jurisdictions_test.sh` | route `backend/src/routes/customer.routes.js:createQuoteRouter`; curl in `backend/tests/api/quote_jurisdictions_test.sh` |
| GET `/api/quote/slots` | yes | true no-mock HTTP | `backend/tests/api/quote_slots_test.sh` | route `backend/src/routes/customer.routes.js:createQuoteRouter`; curl in `backend/tests/api/quote_slots_test.sh` |
| POST `/api/quote` | yes | true no-mock HTTP | `backend/tests/api/bundle_quote_defaults_test.sh` | route `backend/src/routes/customer.routes.js:createQuoteRouter`; curl in `backend/tests/api/bundle_quote_defaults_test.sh` |
| POST `/api/orders` | yes | true no-mock HTTP | `backend/tests/api/ola_access_control_test.sh` | route `backend/src/routes/orders.routes.js:createOrdersRouter`; curl in `backend/tests/api/ola_access_control_test.sh` |
| GET `/api/orders` | yes | true no-mock HTTP | `backend/tests/api/orders_list_test.sh` | route `backend/src/routes/orders.routes.js:createOrdersRouter`; curl in `backend/tests/api/orders_list_test.sh` |
| GET `/api/orders/:id` | yes | true no-mock HTTP | `backend/tests/api/masking_profile_order_test.sh` | route `backend/src/routes/orders.routes.js:createOrdersRouter`; curl in `backend/tests/api/masking_profile_order_test.sh` |
| POST `/api/orders/:id/cancel` | yes | true no-mock HTTP | `backend/tests/api/order_cancel_test.sh` | route `backend/src/routes/orders.routes.js:createOrdersRouter`; curl in `backend/tests/api/order_cancel_test.sh` |
| GET `/api/staff/orders/slots` | yes | true no-mock HTTP | `backend/tests/api/staff_orders_slots_test.sh` | route `backend/src/routes/orders.routes.js:createStaffOrdersRouter`; curl in `backend/tests/api/staff_orders_slots_test.sh` |
| POST `/api/staff/orders/slots` | yes | true no-mock HTTP | `backend/tests/api/staff_orders_slots_test.sh` | route `backend/src/routes/orders.routes.js:createStaffOrdersRouter`; curl in `backend/tests/api/staff_orders_slots_test.sh` |
| POST `/api/staff/orders/slots/:id` | no | unit-only / indirect | - | route `backend/src/routes/orders.routes.js:createStaffOrdersRouter`; no direct HTTP call found in `backend/tests/api/*.sh` |
| DELETE `/api/staff/orders/slots/:id` | yes | true no-mock HTTP | `backend/tests/api/staff_orders_slots_test.sh` | route `backend/src/routes/orders.routes.js:createStaffOrdersRouter`; curl in `backend/tests/api/staff_orders_slots_test.sh` |
| POST `/api/staff/orders/:id/complete` | yes | true no-mock HTTP | `backend/tests/api/staff_order_complete_test.sh` | route `backend/src/routes/orders.routes.js:createStaffOrdersRouter`; curl in `backend/tests/api/staff_order_complete_test.sh` |
| GET `/api/admin/audit` | yes | true no-mock HTTP | `backend/tests/api/admin_audit_risk_test.sh` | route `backend/src/routes/admin.routes.js:createAdminRouter`; curl in `backend/tests/api/admin_audit_risk_test.sh` |
| GET `/api/admin/blacklist` | yes | true no-mock HTTP | `backend/tests/api/admin_blacklist_upsert_test.sh` | route `backend/src/routes/admin.routes.js:createAdminRouter`; curl in `backend/tests/api/admin_blacklist_upsert_test.sh` |
| POST `/api/admin/blacklist` | yes | true no-mock HTTP | `backend/tests/api/admin_blacklist_upsert_test.sh` | route `backend/src/routes/admin.routes.js:createAdminRouter`; curl in `backend/tests/api/admin_blacklist_upsert_test.sh` |
| GET `/api/services` | yes | true no-mock HTTP | `backend/tests/api/catalog_filter_query_test.sh` | route `backend/src/routes/catalog.routes.js:createCatalogRouter`; curl in `backend/tests/api/catalog_filter_query_test.sh` |
| GET `/api/search` | yes | true no-mock HTTP | `backend/tests/api/search_published_only_test.sh` | route `backend/src/routes/catalog.routes.js:createCatalogRouter`; curl in `backend/tests/api/search_published_only_test.sh` |
| GET `/api/services/:id` | yes | true no-mock HTTP | `backend/tests/api/catalog_unpublished_visibility_test.sh` | route `backend/src/routes/catalog.routes.js:createCatalogRouter`; curl in `backend/tests/api/catalog_unpublished_visibility_test.sh` |
| GET `/api/services/:id/questions` | yes | true no-mock HTTP | `backend/tests/api/qa_flow_visibility_test.sh` | route `backend/src/routes/catalog.routes.js:createCatalogRouter`; curl in `backend/tests/api/qa_flow_visibility_test.sh` |
| POST `/api/services/:id/questions` | yes | true no-mock HTTP | `backend/tests/api/qa_flow_visibility_test.sh` | route `backend/src/routes/catalog.routes.js:createCatalogRouter`; curl in `backend/tests/api/qa_flow_visibility_test.sh` |
| GET `/api/services/:id/reviews` | yes | true no-mock HTTP | `backend/tests/api/review_quarantine_visibility_test.sh` | route `backend/src/routes/catalog.routes.js:createCatalogRouter`; curl in `backend/tests/api/review_quarantine_visibility_test.sh` |
| GET `/api/moderation/questions` | yes | true no-mock HTTP | `backend/tests/api/qa_flow_visibility_test.sh` | route `backend/src/routes/catalog.routes.js:createCatalogRouter`; curl in `backend/tests/api/qa_flow_visibility_test.sh` |
| POST `/api/moderation/questions/:id/publish` | yes | true no-mock HTTP | `backend/tests/api/qa_flow_visibility_test.sh` | route `backend/src/routes/catalog.routes.js:createCatalogRouter`; curl in `backend/tests/api/qa_flow_visibility_test.sh` |
| POST `/api/moderation/questions/:id/reject` | yes | true no-mock HTTP | `backend/tests/api/qa_flow_visibility_test.sh` | route `backend/src/routes/catalog.routes.js:createCatalogRouter`; curl in `backend/tests/api/qa_flow_visibility_test.sh` |
| POST `/api/staff/services` | yes | true no-mock HTTP | `backend/tests/api/auth_wrong_role_403_test.sh` | route `backend/src/routes/catalog.routes.js:createStaffCatalogRouter`; curl in `backend/tests/api/auth_wrong_role_403_test.sh` |
| PATCH `/api/staff/services/:id` | yes | true no-mock HTTP | `backend/tests/api/staff_service_update_test.sh` | route `backend/src/routes/catalog.routes.js:createStaffCatalogRouter`; curl in `backend/tests/api/staff_service_update_test.sh` |
| POST `/api/staff/services/:id/publish` | yes | true no-mock HTTP | `backend/tests/api/catalog_publish_visibility_test.sh` | route `backend/src/routes/catalog.routes.js:createStaffCatalogRouter`; curl in `backend/tests/api/catalog_publish_visibility_test.sh` |
| POST `/api/staff/services/:id/unpublish` | yes | true no-mock HTTP | `backend/tests/api/staff_service_unpublish_test.sh` | route `backend/src/routes/catalog.routes.js:createStaffCatalogRouter`; curl in `backend/tests/api/staff_service_unpublish_test.sh` |
| POST `/api/staff/bundles` | yes | true no-mock HTTP | `backend/tests/api/bundle_quote_defaults_test.sh` | route `backend/src/routes/catalog.routes.js:createStaffCatalogRouter`; curl in `backend/tests/api/bundle_quote_defaults_test.sh` |
| PATCH `/api/staff/bundles/:id` | yes | true no-mock HTTP | `backend/tests/api/staff_bundle_operations_test.sh` | route `backend/src/routes/catalog.routes.js:createStaffCatalogRouter`; curl in `backend/tests/api/staff_bundle_operations_test.sh` |
| POST `/api/staff/bundles/:id/publish` | yes | true no-mock HTTP | `backend/tests/api/staff_bundle_operations_test.sh` | route `backend/src/routes/catalog.routes.js:createStaffCatalogRouter`; curl in `backend/tests/api/staff_bundle_operations_test.sh` |
| POST `/api/staff/bundles/:id/unpublish` | yes | true no-mock HTTP | `backend/tests/api/staff_bundle_operations_test.sh` | route `backend/src/routes/catalog.routes.js:createStaffCatalogRouter`; curl in `backend/tests/api/staff_bundle_operations_test.sh` |
| GET `/api/content/manage` | yes | true no-mock HTTP | `backend/tests/api/content_manage_test.sh` | route `backend/src/routes/content.routes.js:createContentRouter`; curl in `backend/tests/api/content_manage_test.sh` |
| GET `/api/content` | yes | true no-mock HTTP | `backend/tests/api/content_public_read_test.sh` | route `backend/src/routes/content.routes.js:createContentRouter`; curl in `backend/tests/api/content_public_read_test.sh` |
| GET `/api/content/:id` | yes | true no-mock HTTP | `backend/tests/api/content_public_read_test.sh` | route `backend/src/routes/content.routes.js:createContentRouter`; curl in `backend/tests/api/content_public_read_test.sh` |
| POST `/api/content` | yes | true no-mock HTTP | `backend/tests/api/content_invalid_media_purpose_test.sh` | route `backend/src/routes/content.routes.js:createContentRouter`; curl in `backend/tests/api/content_invalid_media_purpose_test.sh` |
| PATCH `/api/content/:id/draft` | yes | true no-mock HTTP | `backend/tests/api/content_rollback_test.sh` | route `backend/src/routes/content.routes.js:createContentRouter`; curl in `backend/tests/api/content_rollback_test.sh` |
| POST `/api/content/:id/schedule` | yes | true no-mock HTTP | `backend/tests/api/content_schedule_visibility_test.sh` | route `backend/src/routes/content.routes.js:createContentRouter`; curl in `backend/tests/api/content_schedule_visibility_test.sh` |
| POST `/api/content/:id/publish` | yes | true no-mock HTTP | `backend/tests/api/content_public_read_test.sh` | route `backend/src/routes/content.routes.js:createContentRouter`; curl in `backend/tests/api/content_public_read_test.sh` |
| GET `/api/content/:id/versions` | yes | true no-mock HTTP | `backend/tests/api/content_rollback_test.sh` | route `backend/src/routes/content.routes.js:createContentRouter`; curl in `backend/tests/api/content_rollback_test.sh` |
| POST `/api/content/:id/rollback` | yes | true no-mock HTTP | `backend/tests/api/content_rollback_test.sh` | route `backend/src/routes/content.routes.js:createContentRouter`; curl in `backend/tests/api/content_rollback_test.sh` |
| POST `/api/media` | yes | true no-mock HTTP | `backend/tests/api/content_invalid_media_purpose_test.sh` | route `backend/src/routes/media.routes.js:createMediaRouter`; curl in `backend/tests/api/content_invalid_media_purpose_test.sh` |
| GET `/api/media/files/:id` | yes | true no-mock HTTP | `backend/tests/api/media_file_get_test.sh` | route `backend/src/routes/media.routes.js:createMediaRouter`; curl in `backend/tests/api/media_file_get_test.sh` |
| DELETE `/api/media/:id` | yes | true no-mock HTTP | `backend/tests/api/media_delete_blocked_test.sh` | route `backend/src/routes/media.routes.js:createMediaRouter`; curl in `backend/tests/api/media_delete_blocked_test.sh` |
| POST `/api/reviews` | yes | true no-mock HTTP | `backend/tests/api/ola_access_control_test.sh` | route `backend/src/routes/reviews.routes.js:createReviewsRouter`; curl in `backend/tests/api/ola_access_control_test.sh` |
| GET `/api/moderation/reviews` | yes | true no-mock HTTP | `backend/tests/api/moderation_list_test.sh` | route `backend/src/routes/reviews.routes.js:createReviewsRouter`; curl in `backend/tests/api/moderation_list_test.sh` |
| POST `/api/moderation/reviews/:id/approve` | yes | true no-mock HTTP | `backend/tests/api/moderation_review_approve_test.sh` | route `backend/src/routes/reviews.routes.js:createReviewsRouter`; curl in `backend/tests/api/moderation_review_approve_test.sh` |
| POST `/api/moderation/reviews/:id/reject` | yes | true no-mock HTTP | `backend/tests/api/moderation_review_reject_test.sh` | route `backend/src/routes/reviews.routes.js:createReviewsRouter`; curl in `backend/tests/api/moderation_review_reject_test.sh` |
| POST `/api/tickets` | yes | true no-mock HTTP | `backend/tests/api/ola_access_control_test.sh` | route `backend/src/routes/tickets.routes.js:createTicketsRouter`; curl in `backend/tests/api/ola_access_control_test.sh` |
| GET `/api/tickets` | yes | true no-mock HTTP | `backend/tests/api/tickets_list_test.sh` | route `backend/src/routes/tickets.routes.js:createTicketsRouter`; curl in `backend/tests/api/tickets_list_test.sh` |
| GET `/api/tickets/:id` | yes | true no-mock HTTP | `backend/tests/api/ola_access_control_test.sh` | route `backend/src/routes/tickets.routes.js:createTicketsRouter`; curl in `backend/tests/api/ola_access_control_test.sh` |
| POST `/api/tickets/:id/status` | yes | true no-mock HTTP | `backend/tests/api/ticket_resolve_immutable_test.sh` | route `backend/src/routes/tickets.routes.js:createTicketsRouter`; curl in `backend/tests/api/ticket_resolve_immutable_test.sh` |
| POST `/api/tickets/:id/legal-hold` | yes | true no-mock HTTP | `backend/tests/api/retention_legal_hold_policy_test.sh` | route `backend/src/routes/tickets.routes.js:createTicketsRouter`; curl in `backend/tests/api/retention_legal_hold_policy_test.sh` |
| POST `/api/tickets/:id/resolve` | yes | true no-mock HTTP | `backend/tests/api/retention_legal_hold_policy_test.sh` | route `backend/src/routes/tickets.routes.js:createTicketsRouter`; curl in `backend/tests/api/retention_legal_hold_policy_test.sh` |
| POST `/api/staff/messages` | yes | true no-mock HTTP | `backend/tests/api/inbox_mark_read_test.sh` | route `backend/src/routes/inbox.routes.js:createStaffMessagesRouter`; curl in `backend/tests/api/inbox_mark_read_test.sh` |
| GET `/api/inbox` | yes | true no-mock HTTP | `backend/tests/api/inbox_mark_read_test.sh` | route `backend/src/routes/inbox.routes.js:createInboxRouter`; curl in `backend/tests/api/inbox_mark_read_test.sh` |
| POST `/api/inbox/:id/read` | yes | true no-mock HTTP | `backend/tests/api/inbox_mark_read_test.sh` | route `backend/src/routes/inbox.routes.js:createInboxRouter`; curl in `backend/tests/api/inbox_mark_read_test.sh` |
| GET `/api/internal/seed-check` | yes | true no-mock HTTP | `backend/tests/api/internal_routes_token_required_test.sh` | route `backend/src/routes/internal.routes.js:createInternalRouter`; curl in `backend/tests/api/internal_routes_token_required_test.sh` |
| POST `/api/internal/test-fixtures/booking-slot` | yes | true no-mock HTTP | `backend/tests/api/ola_access_control_test.sh` | route `backend/src/routes/internal.routes.js:createInternalRouter`; curl in `backend/tests/api/ola_access_control_test.sh` |
| POST `/api/internal/test-fixtures/completed-order` | yes | true no-mock HTTP | `backend/tests/api/retention_legal_hold_policy_test.sh` | route `backend/src/routes/internal.routes.js:createInternalRouter`; curl in `backend/tests/api/retention_legal_hold_policy_test.sh` |
| POST `/api/internal/test-fixtures/blacklist-ip` | yes | true no-mock HTTP | `backend/tests/api/blacklist_ip_test.sh` | route `backend/src/routes/internal.routes.js:createInternalRouter`; curl in `backend/tests/api/blacklist_ip_test.sh` |
| POST `/api/internal/constraints/users-username` | yes | true no-mock HTTP | `backend/tests/api/unique_username_test.sh` | route `backend/src/routes/internal.routes.js:createInternalRouter`; curl in `backend/tests/api/unique_username_test.sh` |

## API Test Classification

1. **True No-Mock HTTP**
   - `backend/tests/api/*.sh` (80 shell API tests, request via `curl` to running API host, no in-test mocks).
   - Evidence of real bootstrapped stack path in `run_tests.sh:24`, `run_tests.sh:108-186` and Docker dependency graph in `docker-compose.yml:92-126`.
   - FE↔BE E2E present in Playwright (`frontend/tests/e2e/tests/*.spec.ts`, config in `frontend/tests/e2e/playwright.config.ts:11`).

2. **HTTP with Mocking**
   - `frontend/tests/unit/api/client.test.ts` stubs transport via `vi.stubGlobal('fetch', ...)` (e.g., `frontend/tests/unit/api/client.test.ts:23`, `frontend/tests/unit/api/client.test.ts:53`).
   - These tests validate client behavior, not real route handlers.

3. **Non-HTTP (unit/integration without HTTP)**
   - Backend unit tests in `backend/tests/unit/**` call services/controllers directly (e.g., `backend/tests/unit/controllers/authController.test.js:38`, `backend/tests/unit/services/tickets/ticketsService.test.js:13`).
   - Frontend API module tests mock `@/api/client` and assert call contracts (e.g., `frontend/tests/unit/features/catalog/api/catalogApi.test.ts:5`).

## Mock Detection

- `vi.mock('@/api/client', ...)` in many FE unit API tests (e.g., `frontend/tests/unit/features/catalog/api/catalogApi.test.ts:5`, `frontend/tests/unit/features/auth/api/authApi.test.ts:5`, `frontend/tests/unit/features/tickets/api/ticketsApi.test.ts:5`).
- `vi.stubGlobal('fetch', ...)` in FE client tests (`frontend/tests/unit/api/client.test.ts:23`, `frontend/tests/unit/api/client.test.ts:53`).
- `vi.mock` for hooks/components in FE page/component tests (e.g., `frontend/tests/unit/features/catalog/pages/CatalogPage.test.tsx:8`, `frontend/tests/unit/features/tickets/pages/TicketCreatePage.test.tsx:14`).
- Backend controller unit tests inject fake dependencies (service/database stubs) and bypass HTTP (`backend/tests/unit/controllers/authController.test.js:38-74`).
- No `jest.mock`/`vi.mock`/`sinon.stub` found in backend API shell tests (`backend/tests/api/*.sh`).

## Coverage Summary

- Total endpoints: **75**
- Endpoints with HTTP tests: **74**
- Endpoints with TRUE no-mock HTTP tests: **74**
- HTTP coverage: **98.67%** (74/75)
- True API coverage: **98.67%** (74/75)

## Unit Test Summary

### Backend Unit Tests

- Test files: `backend/tests/unit/**` (controllers, middleware, repositories, services, workers, validators, security/sla utilities).
- Controllers covered: only `authController` (`backend/tests/unit/controllers/authController.test.js`).
- Services covered: broad coverage across 19/20 service modules; `catalogService.js` has no direct unit test file (present in source at `backend/src/services/catalog/catalogService.js`, no matching `backend/tests/unit/services/catalog/catalogService.test.js`).
- Repositories covered: only `bundleRepository` (`backend/tests/unit/repositories/bundleRepository.test.js`); other repositories untested at unit level.
- Auth/guards/middleware covered: `authenticate`, `authorizeRoute`, `errorHandler` (`backend/tests/unit/middleware/*.test.js`); `enforceBlacklist` and `validate` have no direct unit test files.
- Important backend modules not unit-tested directly:
  - Controllers: `adminController`, `catalogController`, `contentController`, `customerController`, `inboxController`, `internalController`, `mediaController`, `ordersController`, `reviewsController`, `ticketsController`.
  - Repositories: `catalogRepository`, `contentRepository`, `mediaRepository`, `messagesRepository`, `ordersRepository`, `reviewsRepository`, `ticketsRepository`, `usersRepository`.
  - Middleware: `enforceBlacklist`, `validate`.
  - Service: `catalogService`.

### Frontend Unit Tests (STRICT REQUIREMENT)

- Frontend test files exist: `frontend/tests/unit/**/*.test.ts(x)` (examples: `frontend/tests/unit/features/catalog/pages/CatalogPage.test.tsx`, `frontend/tests/unit/features/auth/components/ProtectedRoute.test.tsx`).
- Frameworks/tools detected:
  - Vitest (`frontend/package.json:10-11`, test imports e.g., `frontend/tests/unit/features/catalog/pages/CatalogPage.test.tsx:1`)
  - React Testing Library (`frontend/tests/unit/features/catalog/pages/CatalogPage.test.tsx:2`)
  - JSDOM config (`frontend/vite.config.ts:37`)
- Components/modules covered:
  - Pages: `LoginPage`, `RegisterPage`, `CatalogPage`, `TicketsListPage`, `TicketCreatePage`.
  - Components: `ProtectedRoute`, `RoleRoute`, `RoleGate`, `RouteErrorFallback`.
  - Hooks/libs/APIs: `useAuth`, shared libs, and feature API adapters under `features/*/api`.
- Important frontend components/modules not unit-tested directly:
  - App shell/routing: `frontend/src/app/App.tsx`, `frontend/src/app/router.tsx`, `frontend/src/app/providers.tsx`, `frontend/src/app/RootRedirect.tsx`.
  - High-impact pages without unit tests: `ServiceDetailPage`, `CheckoutPage`, `OrderDetailPage`, `ReviewSubmitPage`, `TicketDetailPage`, `InboxPage`, `SearchPage`, `ModerationQueuePage`, `QuestionModerationPage`, `ContentListPage`, `ContentArticlePage`, `ContentStudioPage`, `AdminHomePage`, `OpsHomePage`, `OpsCatalogPage`, `OpsMessagesPage`, `OpsSlotsPage`, `ModHomePage`, `ComparePage`, `FavoritesPage`.
  - Key components without direct unit tests: `ServiceCard`, `ServiceDetailHeader`, `QuestionsSection`, `ReviewsSection`, `ModerationRoute`, `AuthShell`.

**Mandatory verdict: Frontend unit tests: PRESENT**

### Cross-Layer Observation

- API test depth is now very high on backend routes.
- Frontend unit suite exists, but coverage is still concentrated on selected pages/components and API adapters; many routed pages are not unit-tested.

## API Observability Check

- Backend API shell tests are mostly **strong**: explicit method/path, request payload, and response assertions (e.g., `backend/tests/api/ticket_status_transition_policy_test.sh:29-75`, `backend/tests/api/validation_error_shape_test.sh:5-18`).
- Some tests are assertion-light/mostly status checks (e.g., `backend/tests/api/health_check_test.sh:5-10`) but still include endpoint + expected response body.
- FE Playwright tests are UI-observable; API request/response payloads are not consistently asserted at API field level (weaker for backend payload observability).

## Test Quality & Sufficiency

- Strengths:
  - Strong real API scenarios for auth/rate-limit/authorization/resource lifecycle (`backend/tests/api/*.sh`).
  - Good negative-path coverage in backend service units (e.g., ticket/review services).
  - Conditional internal routes are tested for token enforcement (`backend/tests/api/internal_routes_token_required_test.sh`).
- Gaps:
  - 1/75 endpoint has no direct HTTP test hit: `POST /api/staff/orders/slots/:id`.
  - Several high-value backend modules still lack direct unit tests (non-auth controllers and most repositories).
  - FE unit coverage still does not include many route entry pages/components.
- `run_tests.sh` check:
  - Docker-driven orchestration is present (`run_tests.sh:24`, `docker-compose.yml:108-126`) -> **OK**.
  - Script intentionally fails if Docker is unavailable (`run_tests.sh:31-32`), so no local unmanaged dependency path is used.

## End-to-End Expectations (Fullstack)

- Real FE↔BE E2E tests exist via Playwright and proxied API (`frontend/tests/e2e/playwright.config.ts:11`, `docker-compose.yml:71-82`, `docker-compose.yml:92-107`).
- Partial compensation status: API suite is strong; FE unit depth remains uneven across many pages.

## Tests Check

- Static inspection only; no test execution performed.
- Evidence sources inspected: route declarations, API shell tests, unit tests, test orchestrators (`run_tests.sh`, `docker-compose.yml`, `frontend/vite.config.ts`).

## Test Coverage Score (0-100)

**91 / 100**

## Score Rationale

- Positive: near-complete true no-mock API coverage (74/75), strong auth/authorization/failure-path API checks, and real fullstack E2E presence.
- Negative: one backend endpoint still uncovered, missing direct tests for many backend controllers/repositories, broad set of untested frontend route pages/components, and heavy frontend mocking in unit layer.

## Key Gaps

- Uncovered endpoint: `POST /api/staff/orders/slots/:id`.
- Backend unit imbalance: only 1/11 controllers and 1/9 repositories have dedicated unit tests.
- Frontend unit breadth gap across routed pages and key visual/flow components.

## Confidence & Assumptions

- Confidence: **high** for endpoint inventory and backend API-hit mapping (deterministic route + curl static analysis).
- Assumptions:
  - Endpoint coverage was counted only when exact `METHOD + PATH` was directly issued in test code.
  - Internal endpoints counted in inventory despite conditional mount, because route contract exists in source.
  - Frontend API adapter tests with mocked client/fetch were treated as non-true API tests by strict definition.

**Test Coverage Verdict: PARTIAL PASS** (strong coverage, but not complete under strict endpoint rule)

---

# README Audit

## README Location

- Found at required location: `README.md`.

## Hard Gate Failures

- None.

## High Priority Issues

- None.

## Medium Priority Issues

- None.

## Low Priority Issues

- README is detailed and long for first-run onboarding, but still readable and compliant.

## Engineering Quality Notes

- Positives:
  - Explicit project type is now declared (`README.md:3`).
  - Required startup literal is present (`README.md:31`).
  - Access method is explicit (frontend + API URLs with ports) (`README.md:40-41`).
  - Verification steps are explicit (curl + UI flow) (`README.md:58-64`).
  - Demo credentials include all roles (`README.md:47-52`).
  - Docker-contained operational commands are used for maintenance actions (`README.md:97`, `README.md:119`, `README.md:163`).
- Deficits under strict compliance:
  - None that trigger strict hard-gate failure.

## README Verdict

**PASS**

---

## Final Combined Verdicts

- **Test Coverage Audit Verdict:** PARTIAL PASS
- **README Audit Verdict:** PASS

Overall strict-mode outcome: **PARTIALLY COMPLIANT** (README compliant; test coverage still has one uncovered endpoint under strict endpoint rule).
