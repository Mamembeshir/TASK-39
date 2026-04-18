# HomeCareOps Static Delivery Acceptance + Architecture Audit

## 1. Verdict
- Overall conclusion: **Partial Pass**
- Rationale: core marketplace + knowledge hub architecture is present, but there are material defects in API handler correctness, security exposure controls, and documentation/config verifiability that fail key acceptance expectations.

## 2. Scope and Static Verification Boundary
- Reviewed: repository structure, docs, backend entry points/middleware/routes/controllers/services/repositories, frontend routing/pages/api clients, test suites/scripts, and security-related configuration.
- Not reviewed: runtime behavior under real execution, network/TLS handshake behavior, Docker orchestration behavior, browser rendering behavior, database state transitions under real load.
- Intentionally not executed: project startup, tests, Docker, external services (per audit constraints).
- Manual verification required for: TLS certificate trust and transport behavior, UI rendering/usability details, background scheduler runtime cadence, actual concurrency behavior under load.

## 3. Repository / Requirement Mapping Summary
- Prompt core goal mapped: offline-capable local-network home-service marketplace + content hub with quote validation, capacity enforcement, reviews/moderation, tickets/SLA, inbox messaging, admin/staff/mod workflows.
- Main implementation areas mapped:
  - Backend API/security/core logic: `backend/src/app.core.js:281`, `backend/src/config/routePolicies.js:1`, `backend/src/services/**`
  - Persistence/indexing/seeding/search/retention: `backend/src/db.js:90`, `backend/src/dbIndexes.js:1`, `backend/src/scripts/searchCleanup.js:30`, `backend/src/scripts/retentionCleanup.js:67`
  - Frontend customer/staff/mod/admin flows: `frontend/src/app/router.tsx:48`, `frontend/src/features/**/pages/*.tsx`
  - Test assets: `backend/src/**/*.test.js`, `frontend/src/**/*.test.ts`, `API_tests/*.sh`, `run_tests.sh:73`

## 4. Section-by-section Review

### 4.1 Hard Gates

#### 4.1.1 Documentation and static verifiability
- Conclusion: **Fail**
- Rationale: run instructions are incomplete for required env configuration; non-Docker startup path is not statically reproducible from docs alone.
- Evidence:
  - Frontend strictly requires env var `VITE_API_BASE_URL` and throws at startup when absent: `frontend/src/config/env.ts:4`, `frontend/src/config/env.ts:10`
  - README “Run Without Docker” does not document frontend env setup: `README.md:35`
  - Encryption key required by code path but missing from non-Docker setup docs: `backend/src/security.js:6`, `README.md:18`
  - Test command/doc path is Docker-centric in script; README does not provide direct static test guidance: `run_tests.sh:7`, `README.md:1`
- Manual verification note: confirm if additional unpublished setup docs exist outside reviewed tree.

#### 4.1.2 Material deviation from prompt
- Conclusion: **Partial Pass**
- Rationale: implementation is largely aligned to the prompt, but category-routing semantics and handler defects create notable prompt-fit gaps.
- Evidence:
  - Core modules exist for quote/capacity/reviews/tickets/content/search/security: `backend/src/services/quote/quoteService.js:29`, `backend/src/services/orders/ordersService.js:68`, `backend/src/services/reviews/reviewsService.js:18`, `backend/src/services/tickets/ticketsService.js:44`
  - Ticket category model mismatch (frontend categories vs backend routing map), causing many categories to fall to generic routing: `frontend/src/features/tickets/pages/TicketCreatePage.tsx:14`, `backend/src/services/tickets/ticketsService.js:12`, `backend/src/services/tickets/ticketsService.js:20`
  - Q&A moderation/publish endpoint handler contains undefined identifier bug (runtime failure risk): `backend/src/controllers/catalogController.js:43`, `backend/src/controllers/catalogController.js:61`

### 4.2 Delivery Completeness

#### 4.2.1 Core requirements coverage
- Conclusion: **Partial Pass**
- Rationale: most core features are implemented, but at least one core flow has a material correctness defect and a few semantics are weakened.
- Evidence:
  - Catalog/filter/detail/compare/favorites/quote/order/tax/zone handling implemented: `frontend/src/features/catalog/pages/CatalogPage.tsx:27`, `frontend/src/features/orders/pages/CheckoutPage.tsx:121`, `backend/src/pricing.js:124`
  - Atomic capacity decrement + alternatives on conflict: `backend/src/repositories/ordersRepository.js:33`, `backend/src/services/orders/ordersService.js:137`
  - Reviews: verified purchase, 14-day window, one per order, moderation quarantine: `backend/src/services/reviews/reviewsService.js:47`, `backend/src/services/reviews/reviewsService.js:63`, `backend/src/dbIndexes.js:16`, `backend/src/services/reviews/reviewsService.js:98`
  - Tickets/SLA/immutable outcome/retention logic present: `backend/src/services/tickets/ticketsService.js:94`, `backend/src/services/tickets/ticketsService.js:201`, `backend/src/scripts/retentionCleanup.js:75`
  - Material defect in Q&A controller path: `backend/src/controllers/catalogController.js:43`

#### 4.2.2 End-to-end 0→1 deliverable vs partial demo
- Conclusion: **Pass**
- Rationale: repository includes complete frontend+backend+config+tests structure; logic is not just single-file demo code.
- Evidence: `backend/package.json:1`, `frontend/package.json:1`, `backend/src/app.core.js:11`, `frontend/src/app/router.tsx:48`, `API_tests/authorization_matrix_test.sh:1`

### 4.3 Engineering and Architecture Quality

#### 4.3.1 Structure and decomposition
- Conclusion: **Partial Pass**
- Rationale: backend and frontend are reasonably modularized, but backend still relies on a large compatibility core and has wiring mistakes.
- Evidence:
  - Modular services/repositories/controllers/routes exist: `backend/src/bootstrap/registerRoutes.js:1`, `backend/src/services/README.md:1`
  - Large compatibility bootstrap file acknowledged: `backend/src/app.core.js:4`
  - Route/controller wiring defect (undefined `ObjectId` usage in controller): `backend/src/controllers/catalogController.js:43`

#### 4.3.2 Maintainability and extensibility
- Conclusion: **Partial Pass**
- Rationale: extension points exist (service factories, policy map, schedulers), but critical handler defects and public internal toggles reduce operational maintainability/safety.
- Evidence: `backend/src/config/routePolicies.js:1`, `backend/src/workers/contentPublishScheduler.js:39`, `backend/src/bootstrap/registerRoutes.js:279`

### 4.4 Engineering Details and Professionalism

#### 4.4.1 Error handling, logging, validation, API design
- Conclusion: **Partial Pass**
- Rationale: strong baseline exists (structured errors/logging/validation), but key runtime-breaking bug and selective schema strictness gaps remain.
- Evidence:
  - Central error shape: `backend/src/middleware/errorHandler.js:40`
  - Structured logging with redaction: `backend/src/utils/logger.js:5`
  - Request-shape and operator-key validation: `backend/src/middleware/validate.js:27`
  - Auth request schemas are minimal (`min(1)`), relying on service-level checks: `backend/src/validators/authSchemas.js:3`, `backend/src/validators.js:1`
  - Q&A handler runtime bug: `backend/src/controllers/catalogController.js:43`

#### 4.4.2 Product-like deliverable vs demo
- Conclusion: **Pass**
- Rationale: contains role-based consoles, rich domain entities, retention/search workers, and substantial API surface.
- Evidence: `frontend/src/app/router.tsx:148`, `frontend/src/app/router.tsx:152`, `frontend/src/app/router.tsx:160`, `backend/src/scripts/retentionCleanup.js:67`, `backend/src/workers/searchCleanupScheduler.js:20`

### 4.5 Prompt Understanding and Requirement Fit

#### 4.5.1 Business goal and constraints fit
- Conclusion: **Partial Pass**
- Rationale: major business flows are represented with correct technical intent; however, critical defects and category semantics mismatch reduce requirement fidelity.
- Evidence:
  - Server-side deterministic pricing + surcharges + tax rules: `backend/src/pricing.js:99`, `backend/src/pricing.js:250`, `backend/src/pricing.js:261`
  - Capacity and checkout conflict handling: `backend/src/services/orders/ordersService.js:137`
  - Inbox with role targeting and read state: `backend/src/services/inbox/inboxService.js:47`, `backend/src/services/inbox/inboxVisibilityService.js:1`
  - Category mismatch risk: `frontend/src/features/tickets/pages/TicketCreatePage.tsx:14`, `backend/src/services/tickets/ticketsService.js:12`
  - Q&A endpoint defect: `backend/src/controllers/catalogController.js:43`

### 4.6 Aesthetics (frontend/full-stack)

#### 4.6.1 Visual and interaction quality
- Conclusion: **Cannot Confirm Statistically**
- Rationale: static code shows deliberate layout/components/states, but visual rendering quality and UX behavior require browser execution.
- Evidence: `frontend/src/features/catalog/pages/CatalogPage.tsx:42`, `frontend/src/features/orders/pages/CheckoutPage.tsx:171`, `frontend/src/features/tickets/pages/TicketDetailPage.tsx:84`
- Manual verification note: inspect responsive behavior, visual hierarchy, hover/focus states, and real user interactions in browser.

## 5. Issues / Suggestions (Severity-Rated)

### Blocker / High

1) **High** - Undefined identifier breaks service Q&A controller actions
- Conclusion: Fail
- Evidence: `backend/src/controllers/catalogController.js:43`, `backend/src/controllers/catalogController.js:61`
- Impact: customer question submission and moderation publish paths can throw runtime errors (500), breaking a core prompt flow.
- Minimum actionable fix: remove `ObjectId` argument from controller->service call or correctly inject/destructure it in controller scope.

2) **High** - Internal debug/test endpoints become public when enabled
- Conclusion: Fail
- Evidence: `backend/src/bootstrap/registerRoutes.js:279`, `backend/src/routes/internal.routes.js:6`, `backend/src/config/routePolicies.js:1`
- Impact: if `INTERNAL_ROUTES_ENABLED=true` in a non-test environment, unauthenticated actors can create fixtures and alter blacklist/test state.
- Minimum actionable fix: enforce strong auth+admin guard on `/api/internal/*` routes and limit enablement to test env (`NODE_ENV=test`) with explicit hard fail otherwise.

3) **High** - Non-Docker run instructions are not statically reproducible due missing required env config
- Conclusion: Fail
- Evidence: `README.md:18`, `frontend/src/config/env.ts:4`, `frontend/src/config/env.ts:10`, `backend/src/security.js:6`
- Impact: reviewer/operator cannot reliably start/use non-Docker path without discovering undocumented env requirements.
- Minimum actionable fix: document required env vars and provide `.env.example` for frontend/backend (at least `VITE_API_BASE_URL`, `FIELD_ENCRYPTION_KEY`, secrets, DB URI).

### Medium

4) **Medium** - Ticket category taxonomy mismatch degrades deterministic routing semantics
- Conclusion: Partial Fail
- Evidence: `frontend/src/features/tickets/pages/TicketCreatePage.tsx:14`, `backend/src/services/tickets/ticketsService.js:12`, `backend/src/services/tickets/ticketsService.js:20`
- Impact: several UI categories route to fallback `general_queue`, weakening category-to-queue intent from prompt.
- Minimum actionable fix: align frontend category IDs with backend routing map or extend backend map to include current frontend taxonomy.

5) **Medium** - Auth input schema validation is permissive at edge (min length 1 only)
- Conclusion: Partial Fail
- Evidence: `backend/src/validators/authSchemas.js:3`, `backend/src/validators/authSchemas.js:8`
- Impact: weak request validation consistency; password policy enforcement depends on deeper service layer instead of edge schema.
- Minimum actionable fix: align Zod schemas with password/username policy constraints for consistent API contract errors.

## 6. Security Review Summary

- Authentication entry points: **Pass**
  - Evidence: `/api/auth/*` routes + token parsing/verification + lockout/rate-limit: `backend/src/routes/auth.routes.js:6`, `backend/src/middleware/authenticate.js:56`, `backend/src/services/auth/authService.js:31`
- Route-level authorization: **Partial Pass**
  - Evidence: centralized route policies + authorizer middleware: `backend/src/config/routePolicies.js:1`, `backend/src/middleware/authorizeRoute.js:48`
  - Gap: internal routes are not policy-guarded and can be public when env-enabled: `backend/src/bootstrap/registerRoutes.js:279`
- Object-level authorization: **Pass**
  - Evidence: centralized ownership checks for orders/tickets/reviews: `backend/src/services/authorization/ownershipService.js:24`, `backend/src/services/orders/ordersService.js:192`, `backend/src/services/tickets/ticketsService.js:192`
- Function-level authorization: **Partial Pass**
  - Evidence: role-gated staff/admin/moderation endpoints: `backend/src/routes/admin.routes.js:5`, `backend/src/routes/reviews.routes.js:9`
  - Gap: internal controller functions unguarded when mounted: `backend/src/routes/internal.routes.js:6`
- Tenant/user data isolation: **Pass**
  - Evidence: ownership checks + 404 leak-minimized responses + customer-scoped lists: `backend/src/services/authorization/ownershipService.js:37`, `backend/src/repositories/ordersRepository.js:66`, `backend/src/repositories/ticketsRepository.js:34`
- Admin/internal/debug endpoint protection: **Fail**
  - Evidence: admin routes protected, internal routes not: `backend/src/routes/admin.routes.js:5`, `backend/src/routes/internal.routes.js:6`

## 7. Tests and Logging Review

- Unit tests: **Pass**
  - Evidence: substantial backend unit tests for auth, pricing, ownership, services, workers: `backend/package.json:8`, `backend/src/services/auth/authService.test.js:42`, `backend/src/services/orders/ordersService.test.js:13`
- API/integration tests: **Pass**
  - Evidence: broad shell-based API suite (auth, RBAC/OLA, catalog, quote, orders, reviews, tickets, content, retention, search): `run_tests.sh:73`, `API_tests/authorization_matrix_test.sh:41`, `API_tests/order_concurrency_test.sh:63`
- Logging categories / observability: **Partial Pass**
  - Evidence: pino structured request logging with levels and request metadata: `backend/src/utils/logger.js:20`
  - Gap: several services still use raw `console.error` instead of structured logger: `backend/src/controllers/authController.js:107`, `backend/src/services/audit/auditService.js:72`, `backend/src/services/orders/slotService.js:86`
- Sensitive-data leakage risk in logs/responses: **Partial Pass**
  - Evidence: redaction includes auth/password/contact fields: `backend/src/utils/logger.js:8`
  - Gap: cookie tokens are not explicitly redacted in logger path set (`req.headers.cookie` not redacted): `backend/src/utils/logger.js:8`

## 8. Test Coverage Assessment (Static Audit)

### 8.1 Test Overview
- Unit tests exist for backend and frontend API modules.
  - Backend framework: Node test runner: `backend/package.json:8`
  - Frontend framework: Vitest: `frontend/package.json:10`
- API/integration tests exist as shell scripts orchestrated by `run_tests.sh`: `run_tests.sh:73`
- Test entry points are present but README test documentation is minimal/incomplete: `run_tests.sh:1`, `README.md:1`

### 8.2 Coverage Mapping Table

| Requirement / Risk Point | Mapped Test Case(s) | Key Assertion / Fixture / Mock | Coverage Assessment | Gap | Minimum Test Addition |
|---|---|---|---|---|---|
| Auth login + lockout + rate-limit | `API_tests/auth_login_success_test.sh:1`, `API_tests/auth_lockout_test.sh:1`, `API_tests/auth_rate_limit_test.sh:1` | login success and lockout/rate-limit status checks | basically covered | No static proof of full cookie/CSRF interaction | Add integration test asserting cookie-only unsafe request fails without CSRF and succeeds with token |
| Route authorization (401/403 matrix) | `API_tests/authorization_matrix_test.sh:41` | explicit 401 and 403 checks across sensitive routes | sufficient | Internal routes not included | Add negative tests for `/api/internal/*` expecting 401/403 when enabled |
| Object-level authorization (OLA) | `API_tests/ola_access_control_test.sh:92` | cross-user order/ticket/review access returns 404 | sufficient | None material | Add OLA case for media delete ownership + content access variants |
| Atomic slot capacity / oversell prevention | `API_tests/order_concurrency_test.sh:63` | parallel order requests -> 201 + 409 with alternatives | sufficient | Real DB contention timing still runtime-dependent | Add deterministic stress test with >2 concurrent requests |
| Quote validation rules (invalid spec/tax/zone) | `API_tests/quote_invalid_spec_validation_test.sh:1`, `unit_tests/quote_pricing_test.sh:1` | invalid spec rejection + pricing matrix | basically covered | No direct test for required-tax toggle conflict in API layer | Add API test for `INVALID_TAX_OVERRIDE` when tax disabled on tax-required jurisdiction |
| Reviews: one/order + 14-day window + quarantine visibility | `API_tests/review_duplicate_per_order_test.sh:24`, `API_tests/review_window_expired_test.sh:51`, `API_tests/review_quarantine_visibility_test.sh:1` | duplicate 409, window expired 400, quarantine hidden | sufficient | Media header/purpose edge for review attachments depends on media tests | Add integrated review submission with invalid-purpose media id |
| Ticket SLA + immutable outcome + legal hold retention | `API_tests/ticket_sla_fields_test.sh:1`, `API_tests/ticket_resolve_immutable_test.sh:1`, `API_tests/retention_legal_hold_policy_test.sh:147` | SLA fields, immutable resolve, retention cleanup legal-hold behavior | sufficient | Category taxonomy mismatch not covered | Add test verifying all UI-exposed categories map to expected queue/team |
| Content schedule/publish/rollback/search exposure | `API_tests/content_schedule_visibility_test.sh:1`, `API_tests/content_scheduled_publish_execution_test.sh:1`, `API_tests/content_rollback_test.sh:55`, `API_tests/search_published_only_test.sh:1` | publish timing, rollback pointer, published-only search | sufficient | No test for media dependency checks across all content version refs | Add tests for deletion blocked by `mediaRefs` and `versions.mediaRefs` variants |
| Internal route hardening | none mapped | n/a | missing | severe security defect can escape test suite | Add integration tests asserting internal routes require admin even when enabled |
| Controller runtime correctness for Q&A actions | none mapped | n/a | missing | undefined variable defect not caught | Add integration test for `POST /api/services/:id/questions` and moderation publish path |

### 8.3 Security Coverage Audit
- Authentication: **Basically covered** via auth API tests and unit tests (`API_tests/auth_*`, `backend/src/services/auth/authService.test.js:42`).
- Route authorization: **Basically covered** for major routes (`API_tests/authorization_matrix_test.sh:41`), but internal route exposure is untested.
- Object-level authorization: **Sufficiently covered** (`API_tests/ola_access_control_test.sh:92`).
- Tenant/data isolation: **Basically covered** (OLA tests + repository scoping), but no explicit multi-tenant stress scenarios.
- Admin/internal protection: **Insufficient** because tests do not assert internal route hardening, and code shows potential public exposure.

### 8.4 Final Coverage Judgment
**Partial Pass**

- Major business/security flows are covered by a broad static test suite.
- However, uncovered high-risk areas remain (internal route exposure and Q&A controller runtime defect), so tests could still pass while severe defects remain undetected in adjacent paths.

## 9. Final Notes
- This report is static-only and evidence-bound; runtime success claims were intentionally avoided.
- Highest-priority fixes are: (1) Q&A controller undefined identifier, (2) internal route hardening, (3) complete non-Docker env documentation.