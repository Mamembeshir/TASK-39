# HomeCareOps Static Acceptance Audit

## 1. Verdict
- Overall conclusion: **Partial Pass**

## 2. Scope and Static Verification Boundary
- Reviewed: top-level docs, backend bootstrap/routes/services/repositories/middleware, frontend routes/pages/api clients, unit tests, API shell tests, and logging/error handling.
- Not reviewed at runtime: app startup, Docker, MongoDB, browser rendering, scheduled workers, or any live HTTP flows.
- Not executed: project start, tests, Docker, external services.
- Manual verification required: UI rendering quality, end-to-end behavior under real network/database conditions, and scheduler timing.

## 3. Repository / Requirement Mapping Summary
- Prompt core: offline home-service marketplace with catalog/filtering, compare/quote/checkout, atomic capacity, verified reviews, inbox, complaint tickets, media storage, content publishing, and strict auth/authorization.
- Mapped code: backend `app.core.js`, route/controller/service layers, pricing/SLA/media/security modules, frontend route/page modules, and the API/unit test suites.
- Prior high-severity blockers from the first pass now appear fixed in code: booking timestamps are server-derived in quote/order flows, media upload purposes are role-gated with public/private scoping, and the duplicate-key media dedup path now unwraps the updated document.

## 4. Section-by-section Review

### 1.1 Documentation and static verifiability
- Conclusion: **Pass**
- Rationale: README and adjacent docs provide run/config/test entry points, env requirements, TLS/fixture notes, and architecture boundaries.
- Evidence: `README.md:12-205`, `backend/package.json:6-15`, `frontend/package.json:6-11`, `unit_tests/README.md:1-40`, `run_tests.sh:3-164`
- Manual verification note: actual startup and browser behavior still need runtime confirmation.

### 1.2 Prompt deviation
- Conclusion: **Pass**
- Rationale: The earlier trust and access-boundary gaps are now addressed in code, and the product remains aligned to the stated marketplace/helpdesk scenario.
- Evidence: `quoteService.js:249-267`, `ordersService.js:188-251`, `mediaService.js:54-73, 77-160`, `mediaRepository.js:3-10, 59-87`

### 2.1 Core requirements coverage
- Conclusion: **Pass**
- Rationale: Most prompt flows are present, including catalog, compare, quote, checkout, reviews, inbox, tickets, content, and admin consoles. The remaining risk is in the test harness, not the product feature set.
- Evidence: `app.core.js:279-345`, `router.tsx:50-177`, `pricing.js:99-315`, `reviewsService.js:35-148`, `ticketsService.js:94-398`

### 2.2 End-to-end deliverable
- Conclusion: **Pass**
- Rationale: This is a complete multi-module app, not a fragment: backend, frontend, docs, and test suites are all present.
- Evidence: `README.md:12-205`, `backend/src/app.core.js:1-358`, `frontend/src/app/router.tsx:1-177`, `run_tests.sh:93-156`

### 3.1 Engineering structure and module decomposition
- Conclusion: **Pass**
- Rationale: The backend is layered (routes/controllers/services/repositories/middleware), and the frontend is feature-sliced with shared UI primitives.
- Evidence: `backend/src/bootstrap/registerRoutes.js:1-321`, `backend/src/services/README.md:1-26`, `frontend/src/app/router.tsx:1-177`, `frontend/src/shared/components/*`

### 3.2 Maintainability and extensibility
- Conclusion: **Partial Pass**
- Rationale: The module boundaries are reasonable, but `app.core.js` still carries a large amount of composition logic.
- Evidence: `app.core.js:1-358`

### 4.1 Professional engineering details
- Conclusion: **Pass**
- Rationale: Validation, audit logging, redaction, role checks, and error shaping are solid.
- Evidence: `validate.js:27-92`, `errorHandler.js:4-60`, `logger.js:5-75`, `auditService.js:52-91`

### 4.2 Real product vs demo
- Conclusion: **Pass**
- Rationale: The app shape, data model, and flows read like a real product with operational consoles, schedulers, and persistent state.
- Evidence: `docs/ARCHITECTURE-TARGET.md:5-131`, `app.core.js:160-345`, `router.tsx:50-177`

### 5.1 Prompt understanding and requirement fit
- Conclusion: **Pass**
- Rationale: The implementation broadly matches the business goal, and the remaining acceptance risk is confined to outdated shell helpers.
- Evidence: `authController.js:52-132`, `API_tests/authorization_matrix_test.sh:30-66`, `API_tests/ticket_staff_actions_test.sh:25-26`

### 6.1 Aesthetics
- Conclusion: **Cannot Confirm Statistically**
- Rationale: The frontend uses responsive cards/grids/tabs/hover states, but visual quality and interaction polish require rendering in a browser.
- Evidence: `CatalogPage.tsx:58-105`, `ServiceDetailPage.tsx:171-386`, `ComparePage.tsx:185-420`, `InboxPage.tsx:23-69`
- Manual verification note: confirm layout on desktop/mobile in a browser.

## 5. Issues / Suggestions (Severity-Rated)

### Medium
- **Title:** Several shell tests still expect JSON access tokens from login
- **Conclusion:** Fail
- **Evidence:** `authController.js:52-132`, `API_tests/authorization_matrix_test.sh:30-39`, `API_tests/ticket_staff_actions_test.sh:25-26`, `API_tests/orders_list_test.sh:16,107`, `API_tests/admin_blacklist_upsert_test.sh:15`
- **Impact:** The backend now sets auth via cookies, but several API shell tests still parse `payload.accessToken`. The scripted acceptance matrix will misread login responses and fail even when auth works.
- **Minimum actionable fix:** Update the shell/API tests to consume the cookie-based auth contract, or explicitly reintroduce a documented compatibility payload.

## 6. Security Review Summary
- Authentication entry points: **Pass**. JWT login/register/refresh/logout/me are centralized, lockout/rate-limit paths exist, and auth middleware is consistent. Evidence: `auth.routes.js:3-12`, `authenticate.js:104-143`, `authService.js:46-53, 255-325`, `authController.js:31-192`.
- Route-level authorization: **Pass**. Route policies and the route authorizer map public/user/customer/staff/admin/moderation paths consistently. Evidence: `routePolicies.js:1-88`, `authorizeRoute.js:48-64`, `registerRoutes.js:74-315`.
- Object-level authorization: **Pass**. Orders, tickets, reviews, and media reads are ownership-checked, and media upload purpose access is now role-gated. Evidence: `ownershipService.js:24-66`, `mediaService.js:54-73, 173-260`, `ticketsService.js:194-398`, `customerController.js:71-214`.
- Function-level authorization: **Pass**. Most sensitive actions are guarded in controllers/routes, and privileged media upload purposes are rejected for non-staff callers. Evidence: `mediaService.js:54-73`, `media.routes.js:3-8`.
- Tenant / user isolation: **Pass**. Order/ticket/profile masking is good, and media duplicate-retry behavior is now covered. Evidence: `masking_profile_order_test.sh:25-63`, `customerController.js:45-65`, `ordersService.js:288-315`, `mediaService.js:147-160`, `mediaService.test.js:130-168`.
- Admin / internal / debug protection: **Pass**. Admin routes require administrator auth; internal routes require admin auth plus a shared token and are test-gated. Evidence: `admin.routes.js:3-8`, `registerRoutes.js:282-315`, `internal.routes.js:3-15`.

## 7. Tests and Logging Review
- Unit tests: **Pass**. Backend `node --test` suites and shell unit checks exist. Evidence: `backend/package.json:6-15`, `unit_tests/README.md:11-40`, `backend/src/**/*.test.js`, `unit_tests/password_length_test.sh:3-8`, `unit_tests/quote_pricing_test.sh:3-203`.
- API / integration tests: **Partial Pass**. The scripted matrix is broad, but several scripts still expect JSON auth tokens that the current controller no longer returns. Evidence: `run_tests.sh:93-156`, `API_tests/*.sh`, `authController.js:122-132`.
- Logging categories / observability: **Pass**. Request logging is structured, redacted, and paired with audit logging. Evidence: `logger.js:5-75`, `auditService.js:52-91`.
- Sensitive-data leakage risk in logs / responses: **Pass**. Logs redact auth cookies/headers and production 500s omit stack traces; auth responses rely on cookies rather than JSON token fields. Evidence: `logger.js:7-38`, `errorHandler.js:40-55`, `authController.js:12-27, 111-132`.

## 8. Test Coverage Assessment (Static Audit)

### 8.1 Test Overview
- Unit tests exist for backend services/middleware/security/pricing and frontend API helpers. Evidence: `backend/package.json:6-15`, `frontend/package.json:6-11`, `backend/src/**/*.test.js`, `frontend/src/**/*.test.ts`.
- API/integration tests exist as shell scripts. Evidence: `run_tests.sh:93-156`, `API_tests/*.sh`.
- Test commands are documented. Evidence: `README.md:39-68`, `unit_tests/README.md:17-29`, `backend/package.json:7-15`, `frontend/package.json:7-11`.

### 8.2 Coverage Mapping Table
| Requirement / Risk Point | Mapped Test Case(s) | Key Assertion / Fixture / Mock | Coverage Assessment | Gap | Minimum Test Addition |
| --- | --- | --- | --- | --- | --- |
| Password policy and JWT secret safeguards | `unit_tests/password_length_test.sh:3-8`, `backend/src/services/auth/authService.test.js:99-120` | Validates minimum length and placeholder-secret rejection | sufficient | none material | none |
| Same-day pricing, travel bands, tax rules | `unit_tests/quote_pricing_test.sh:45-203`, `backend/src/pricing.bundle.test.js:6-51`, `backend/src/services/orders/ordersService.test.js` (suite present) | Exercises surcharge boundaries and tax-required rejection | sufficient | no new tamper test needed if booking timestamps are server-generated | keep existing coverage |
| Atomic slot decrement / oversell prevention | `API_tests/order_concurrency_test.sh:67-99` | Concurrent POSTs, one 201 and one 409 `SLOT_UNAVAILABLE` | basically covered | no stress beyond one race | add repeated-race or larger fan-in case |
| Compare cap of 5 services | `API_tests/compare_limit_test.sh:16-31`, `frontend/src/features/booking/api/bookingApi.test.ts:149-163` | PUT `/api/compare` with 6 ids returns `COMPARE_LIMIT_EXCEEDED` | sufficient | none material | none |
| Review one-per-order and 14-day window | `API_tests/review_duplicate_per_order_test.sh:28-46`, `API_tests/review_window_expired_test.sh:55-68`, `API_tests/review_verified_visibility_test.sh:24-43` | Second review gets 409; stale review gets `REVIEW_WINDOW_EXPIRED`; verified review appears publicly | sufficient | no test for media-purpose quarantine path on review attachments | add one quarantine-by-term test if coverage is desired |
| Ticket attachment ownership / immutable resolution / SLA | `API_tests/ticket_attachment_ownership_test.sh:63-76`, `API_tests/ticket_resolve_immutable_test.sh:54-84`, `API_tests/ticket_sla_fields_test.sh:33-92` | Cross-user media attachment denied; second resolve and post-resolve status edits fail; SLA fields match expected deadlines | sufficient | none material | none |
| Auth missing token / role denial / internal token protection | `API_tests/auth_missing_token_401_test.sh`, `API_tests/auth_wrong_role_403_test.sh`, `API_tests/internal_routes_token_required_test.sh:7-30`, `API_tests/authorization_matrix_test.sh:41-66` | 401/403 matrix for protected routes; internal route requires shared token | sufficient | shell matrix still needs login-contract alignment | update the login helpers to use cookies |
| Media MIME/size/dedup and object ownership | `API_tests/media_oversize_upload_test.sh`, `API_tests/media_magic_mime_validation_test.sh`, `API_tests/media_dedup_test.sh`, `API_tests/media_delete_ownership_test.sh:65-89`, `backend/src/services/media/mediaService.test.js:13-42, 68-128, 130-168, 246-282` | MIME spoofing rejected, oversize rejected, dedup by hash works, duplicate-key retry returns the deduped doc, non-owner delete denied | sufficient | none material | none |
| Inbox role visibility / read state | `API_tests/inbox_role_visibility_test.sh`, `API_tests/inbox_mark_read_test.sh`, `API_tests/inbox_staff_visibility_test.sh` | Role-targeted messages are visible only to eligible users; read state persists | basically covered | no pagination edge test | add pagination/empty-state test if needed |

### 8.3 Security Coverage Audit
- Authentication: **covered**. Login success, wrong password, lockout, rate limiting, and new-device event coverage exist. Evidence: `API_tests/auth_login_success_test.sh`, `API_tests/auth_wrong_password_test.sh`, `API_tests/auth_lockout_test.sh:15-39`, `API_tests/auth_rate_limit_test.sh`, `API_tests/auth_new_device_event_test.sh`.
- Route authorization: **covered**. Missing-token, wrong-role, and authorization matrix tests exist. Evidence: `API_tests/auth_missing_token_401_test.sh`, `API_tests/auth_wrong_role_403_test.sh`, `API_tests/authorization_matrix_test.sh:41-66`.
- Object-level authorization: **covered for orders/tickets/media deletes**. Evidence: `API_tests/ola_access_control_test.sh`, `API_tests/ticket_attachment_ownership_test.sh:63-76`, `API_tests/media_delete_ownership_test.sh:65-89`.
- Tenant / data isolation: **covered**. Masking, staff-vs-customer visibility, and media dedup retry hardening are tested. Evidence: `API_tests/masking_profile_order_test.sh:25-63`, `API_tests/inbox_role_visibility_test.sh`, `mediaService.js:147-160`, `mediaService.test.js:130-168`.
- Admin / internal protection: **covered**. Internal routes require shared token and admin auth. Evidence: `API_tests/internal_routes_token_required_test.sh:7-30`.

### 8.4 Final Coverage Judgment
- Conclusion: **Partial Pass**
- Boundary: the suite covers many critical happy paths and several core denial cases, but it still needs alignment with the cookie-based auth contract. That gap can let regressions escape or cause false failures in the acceptance matrix.

## 9. Final Notes
- Static quality is generally strong: modular backend, solid docs, broad tests, structured logging, and many correct security controls.
- The remaining medium issue prevents a clean pass until the shell matrix is updated.