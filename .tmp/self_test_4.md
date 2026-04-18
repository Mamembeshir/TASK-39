# HomeCareOps Static Delivery Acceptance + Architecture Audit

## 1. Verdict
- **Overall conclusion: Partial Pass**
- Strong backend coverage for core pricing/capacity/security/moderation flows is present, but delivery is materially incomplete on some Prompt-required console capabilities (notably catalog setup UI operations and staff announcement authoring in app UI), so full acceptance is not met.

## 2. Scope and Static Verification Boundary

### What was reviewed
- Documentation, run/config manifests, env examples, and architecture/security docs: `README.md:1`, `docs/ARCHITECTURE-TARGET.md:1`, `docs/SECURITY.md:1`, `backend/.env.example:1`, `frontend/.env.example:1`, `docker-compose.yml:1`, `nginx/nginx.conf:1`.
- Backend entry points, middleware, route registration, controllers/services/repositories, workers/schedulers, indexes and scripts: `backend/src/server.js:1`, `backend/src/app.core.js:11`, `backend/src/bootstrap/registerRoutes.js:24`, `backend/src/config/routePolicies.js:1`, `backend/src/middleware/*.js`, `backend/src/services/**/*.js`, `backend/src/repositories/**/*.js`, `backend/src/dbIndexes.js:1`.
- Frontend route map and feature pages/APIs for customer + staff + moderation/admin consoles: `frontend/src/app/router.tsx:48`, feature pages and APIs under `frontend/src/features/**`.
- Static tests: backend unit tests, frontend vitest tests, shell API tests, and test orchestration scripts: `backend/src/**/*.test.js`, `frontend/src/**/*.test.ts`, `API_tests/*.sh`, `run_tests.sh:1`, `test-baseline.txt:1`, `unit_tests/*.sh`.

### What was not reviewed / executed
- No runtime execution of app, tests, browser flows, Docker, DB, or network calls (per boundary).
- No dynamic verification of real TLS/cert behavior, race behavior under load, cron timing fidelity, or UI render quality in browser.

### Intentionally not executed
- Project startup, Docker compose, backend/frontend test commands, API scripts.

### Claims requiring manual verification
- End-to-end runtime correctness (all user journeys under real data and concurrent load).
- Visual consistency and responsive behavior in actual browsers.
- Scheduler timing behavior in long-running process.
- Local file serving behavior under actual OS path/security conditions.

## 3. Repository / Requirement Mapping Summary
- **Prompt core goal mapped:** Offline-capable marketplace + knowledge hub with customer booking/quote/checkout/review/ticket/inbox flows and role-separated staff consoles.
- **Core backend mapped:** Pricing/capacity/order/ticket/review/media/content/search/authz/security stacks are implemented in Express + Mongo (`backend/src/app.core.js:11`, `backend/src/services/*`, `backend/src/repositories/*`).
- **Core frontend mapped:** Customer catalog/service/compare/favorites/checkout/order/review/ticket/inbox/search/content plus admin/ops/moderation routes exist (`frontend/src/app/router.tsx:71`, `frontend/src/app/router.tsx:148`).
- **Primary deltas found:** Console capability gaps for catalog setup operations and in-app scheduled/role-targeted message creation from UI.

## 4. Section-by-section Review

### 1. Hard Gates

#### 1.1 Documentation and static verifiability
- **Conclusion: Pass**
- **Rationale:** Startup/config/test surfaces are documented and statically consistent with entry points and scripts.
- **Evidence:** `README.md:12`, `README.md:39`, `README.md:50`, `backend/src/index.js:1`, `backend/src/server.js:1`, `backend/package.json:6`, `frontend/package.json:6`, `run_tests.sh:93`.
- **Manual verification note:** Runtime success still requires manual execution.

#### 1.2 Material deviation from Prompt
- **Conclusion: Partial Pass**
- **Rationale:** Overall implementation aligns with Prompt domain, but key console-operability requirements are only partially delivered in frontend.
- **Evidence:** Delivered domain routes/features: `frontend/src/app/router.tsx:71`, `frontend/src/app/router.tsx:152`, `backend/src/config/routePolicies.js:70`; missing catalog setup UI calls to staff catalog endpoints (no usage found; only ops links): `frontend/src/features/ops/pages/OpsHomePage.tsx:48`, `frontend/src/features/ops/pages/OpsHomePage.tsx:52`, backend endpoints exist: `backend/src/routes/catalog.routes.js:22`, `backend/src/routes/catalog.routes.js:27`.

### 2. Delivery Completeness

#### 2.1 Coverage of explicit core requirements
- **Conclusion: Partial Pass**
- **Rationale:** Most core requirements are implemented (pricing, zones, tax, capacity atomic checks, verified reviews, moderation quarantine, tickets SLA/immutability, media dedup/refcount, search sync/cleanup, RBAC/OLA/rate limit/TLS/encryption/masking). However, at least two explicit capability areas are incomplete in product surface.
- **Evidence:**
  - Pricing/zones/tax/same-day/after-hours: `backend/src/pricing.js:10`, `backend/src/pricing.js:250`, `backend/src/pricing.js:261`.
  - Atomic capacity and alternatives: `backend/src/repositories/ordersRepository.js:33`, `backend/src/services/orders/ordersService.js:234`, `backend/src/services/orders/ordersService.js:236`.
  - Verified single-review and moderation quarantine: `backend/src/dbIndexes.js:16`, `backend/src/services/reviews/reviewsService.js:119`, `backend/src/services/reviews/reviewsService.js:143`.
  - Ticket SLA and immutable outcome: `backend/src/services/tickets/ticketsService.js:146`, `backend/src/services/tickets/ticketsService.js:349`, `backend/src/repositories/ticketsRepository.js:100`.
  - Media local disk + dedup/refcount + header validation + optional processing: `backend/src/services/media/mediaService.js:76`, `backend/src/services/media/mediaService.js:78`, `backend/src/services/media/mediaService.js:187`, `backend/src/services/media/mediaProcessingService.js:3`, `backend/src/services/media/mediaProcessingService.js:60`.
  - Search index + incremental sync + weekly cleanup scheduler: `backend/src/dbIndexes.js:56`, `backend/src/services/search/searchSyncService.js:12`, `backend/src/workers/searchCleanupScheduler.js:3`.
  - Security controls: `backend/src/services/auth/authService.js:49`, `backend/src/services/auth/authService.js:52`, `backend/src/security.js:33`, `backend/src/middleware/enforceBlacklist.js:8`.
  - Incomplete catalog setup console capability (UI): `frontend/src/features/ops/pages/OpsHomePage.tsx:48`, `frontend/src/features/ops/pages/OpsHomePage.tsx:52`, `backend/src/routes/catalog.routes.js:22`.
  - Incomplete staff announcement authoring UI despite backend endpoint: `backend/src/routes/inbox.routes.js:15`, frontend no `/api/staff/messages` usage in app feature APIs.

#### 2.2 Basic end-to-end deliverable vs partial/demo
- **Conclusion: Pass**
- **Rationale:** Repository has full backend/frontend structure, route modules, persistence, tests, docs, and scripts; not a single-file demo.
- **Evidence:** `backend/src/app.core.js:11`, `backend/src/bootstrap/registerRoutes.js:24`, `frontend/src/app/router.tsx:48`, `README.md:182`, `run_tests.sh:93`.

### 3. Engineering and Architecture Quality

#### 3.1 Structure and module decomposition
- **Conclusion: Partial Pass**
- **Rationale:** Decomposition into controllers/services/repositories/routes is good; however, `app.core.js` remains a large integration module and central wiring surface.
- **Evidence:** Layered modules present: `backend/src/bootstrap/registerRoutes.js:1`, `backend/src/services/orders/ordersService.js:1`, `backend/src/repositories/ordersRepository.js:1`; large centralized core: `backend/src/app.core.js:1`, `backend/src/app.core.js:288`.

#### 3.2 Maintainability and extensibility
- **Conclusion: Pass**
- **Rationale:** Core logic is mostly modular and configurable via env/constants; tests exist around many services; route policy model is centralized.
- **Evidence:** `backend/src/config/routePolicies.js:1`, `backend/src/config/appConstants.js:1`, `backend/src/services/*/*.test.js`, `frontend/src/features/*/api/*.ts`.

### 4. Engineering Details and Professionalism

#### 4.1 Error handling, logging, validation, API shape
- **Conclusion: Pass**
- **Rationale:** Central error mapper, schema/request-shape validation, structured logging with redaction, stable error codes, and audit writes are present.
- **Evidence:** `backend/src/middleware/errorHandler.js:40`, `backend/src/middleware/validate.js:27`, `backend/src/utils/logger.js:5`, `backend/src/services/audit/auditService.js:55`.

#### 4.2 Product-like organization vs sample
- **Conclusion: Pass**
- **Rationale:** Includes multi-role UI routes, operational workers, retention/search scripts, and broad automated test assets.
- **Evidence:** `frontend/src/app/router.tsx:148`, `backend/src/workers/contentPublishScheduler.js:39`, `backend/src/scripts/retentionCleanup.js:84`, `API_tests/order_concurrency_test.sh:67`.

### 5. Prompt Understanding and Requirement Fit

#### 5.1 Business goal and semantic fit
- **Conclusion: Partial Pass**
- **Rationale:** Core booking/trust/safety/workflow semantics are well represented, but role-console semantics for catalog setup and announcement operations are not fully realized in UI.
- **Evidence:** Core fit: `frontend/src/features/catalog/pages/ServiceDetailPage.tsx:95`, `frontend/src/features/orders/pages/CheckoutPage.tsx:137`, `frontend/src/features/tickets/pages/TicketDetailPage.tsx:121`, `backend/src/services/tickets/ticketsService.js:328`; console gaps: `frontend/src/features/ops/pages/OpsHomePage.tsx:48`, backend staff catalog routes: `backend/src/routes/catalog.routes.js:22`, backend staff message route: `backend/src/routes/inbox.routes.js:15`.

### 6. Aesthetics (frontend)

#### 6.1 Visual and interaction quality fit
- **Conclusion: Partial Pass**
- **Rationale:** Static code shows coherent tokenized design system, spacing hierarchy, and interaction states; runtime rendering quality/responsiveness cannot be fully proven statically.
- **Evidence:** design tokens/theme: `frontend/src/index.css:12`; reusable shells/components: `frontend/src/shared/components/PageShell.tsx`, `frontend/src/shared/components/PageHeader.tsx`; interaction affordances: `frontend/src/features/catalog/pages/ServiceDetailPage.tsx:365`, `frontend/src/features/inbox/pages/InboxPage.tsx:48`.
- **Manual verification note:** Browser-based responsive and visual correctness requires manual review.

## 5. Issues / Suggestions (Severity-Rated)

### Blocker / High

1) **Severity: High**  
**Title:** Prompt-required catalog setup console capability is missing in frontend  
**Conclusion:** Fail (requirement gap)  
**Evidence:** Staff catalog APIs exist: `backend/src/routes/catalog.routes.js:22`, `backend/src/routes/catalog.routes.js:27`; ops/admin UI does not provide create/update/publish service/bundle operations and no frontend API usage for `/api/staff/services` or `/api/staff/bundles` (ops links only): `frontend/src/features/ops/pages/OpsHomePage.tsx:48`, `frontend/src/features/ops/pages/OpsHomePage.tsx:52`.  
**Impact:** Service Managers/Administrators cannot statically be shown to “operate console for catalog setup” as required by Prompt.  
**Minimum actionable fix:** Add dedicated Ops catalog management UI (forms/actions for create/update/publish/unpublish services and bundles) wired to existing staff endpoints.

2) **Severity: High**  
**Title:** In-app scheduled/role-targeted staff message authoring UI is not delivered  
**Conclusion:** Partial Fail (feature surface incomplete)  
**Evidence:** Backend creation endpoint exists (`POST /api/staff/messages`): `backend/src/routes/inbox.routes.js:15`, `backend/src/services/inbox/inboxService.js:5`; frontend has inbox read/mark-read only: `frontend/src/features/inbox/api/inboxApi.ts:7`, `frontend/src/features/inbox/pages/InboxPage.tsx:14`; no frontend API/page calling `/api/staff/messages`.  
**Impact:** “Scheduled announcements and role-targeted messages” are only consumable, not operable from delivered consoles.  
**Minimum actionable fix:** Add staff message composer UI (publishAt, role targets, optional recipient user), connect to `/api/staff/messages`, include role guard.

### Medium

3) **Severity: Medium**  
**Title:** Backend integration composition remains overly centralized in `app.core.js`  
**Conclusion:** Maintainability risk  
**Evidence:** Large combined wiring/middleware/composition module: `backend/src/app.core.js:11`, `backend/src/app.core.js:288`.  
**Impact:** Higher regression risk and slower onboarding/change velocity for security-critical route behavior.  
**Minimum actionable fix:** Continue extracting bootstrap/runtime concerns into smaller composition modules (auth/security pipeline, worker startup, route assembly) while preserving contracts.

4) **Severity: Medium**  
**Title:** Some acceptance aspects remain only indirectly provable statically  
**Conclusion:** Cannot Confirm Statistically  
**Evidence:** Scheduler timing behavior relies on runtime loops: `backend/src/workers/searchCleanupScheduler.js:33`, `backend/src/workers/contentPublishScheduler.js:71`, `backend/src/workers/retentionCleanupScheduler.js:41`.  
**Impact:** Severe timing/drift bugs could survive static checks.  
**Minimum actionable fix:** Add deterministic integration tests for scheduler tick behavior against fixture DB state and include explicit runbook assertions.

## 6. Security Review Summary

- **Authentication entry points: Pass** — JWT login/register/refresh/logout/me routes and password minimum are implemented with lockout/rate limit controls. Evidence: `backend/src/routes/auth.routes.js:6`, `backend/src/services/auth/authService.js:49`, `backend/src/validators/authSchemas.js:17`.
- **Route-level authorization: Pass** — Central policy matcher + role middleware with explicit matrix. Evidence: `backend/src/config/routePolicies.js:1`, `backend/src/middleware/authorizeRoute.js:48`.
- **Object-level authorization: Pass** — Ownership checks centralized for order/ticket/review submission with 404 leak minimization. Evidence: `backend/src/services/authorization/ownershipService.js:24`, `backend/src/services/orders/ordersService.js:291`, `backend/src/services/tickets/ticketsService.js:197`.
- **Function-level authorization: Pass** — Sensitive actions protected by role middleware (admin/moderation/staff/internal token). Evidence: `backend/src/routes/admin.routes.js:5`, `backend/src/routes/reviews.routes.js:9`, `backend/src/routes/internal.routes.js:5`.
- **Tenant/user data isolation: Pass** — Per-user listing and ownership filters present for orders/tickets/inbox/media. Evidence: `backend/src/repositories/ordersRepository.js:68`, `backend/src/repositories/ticketsRepository.js:34`, `backend/src/services/inbox/inboxVisibilityService.js:5`, `backend/src/services/media/mediaService.js:161`.
- **Admin/internal/debug endpoint protection: Pass** — internal routes disabled by default; if enabled require `NODE_ENV=test`, admin auth, and shared token. Evidence: `backend/src/bootstrap/registerRoutes.js:282`, `backend/src/bootstrap/registerRoutes.js:292`, `backend/src/routes/internal.routes.js:9`.

## 7. Tests and Logging Review

- **Unit tests: Pass** — substantial service/middleware/security/unit shell coverage exists. Evidence: `backend/src/services/orders/ordersService.test.js:13`, `backend/src/middleware/authenticate.test.js:14`, `backend/src/security.test.js:6`, `unit_tests/quote_pricing_test.sh:45`.
- **API/integration tests: Pass (static presence)** — broad shell API tests across authz/OLA/concurrency/moderation/retention/search exist and are orchestrated. Evidence: `run_tests.sh:93`, `API_tests/authorization_matrix_test.sh:42`, `API_tests/ola_access_control_test.sh:96`, `API_tests/order_concurrency_test.sh:67`.
- **Logging categories/observability: Pass** — structured request logging with levels, request id, route/outcome/user context and audit trails. Evidence: `backend/src/utils/logger.js:42`, `backend/src/utils/logger.js:58`, `backend/src/services/audit/auditService.js:80`.
- **Sensitive-data leakage risk: Partial Pass** — redaction list is strong for common secrets/PII fields, but static analysis cannot prove no accidental leakage in all future log payloads. Evidence: `backend/src/utils/logger.js:8`, `backend/src/utils/logger.js:23`, `backend/src/middleware/errorHandler.js:51`.

## 8. Test Coverage Assessment (Static Audit)

### 8.1 Test Overview
- Unit tests exist for backend services/middleware/security/schedulers and frontend API client modules. Evidence: `backend/package.json:8`, `frontend/package.json:10`, `backend/src/**/*.test.js`, `frontend/src/**/*.test.ts`.
- API/integration shell tests exist and are centrally orchestrated in `run_tests.sh`. Evidence: `run_tests.sh:93`.
- Documentation includes test orchestration entry script but no separate API_tests README was found. Evidence: `run_tests.sh:1`.

### 8.2 Coverage Mapping Table

| Requirement / Risk Point | Mapped Test Case(s) | Key Assertion / Fixture / Mock | Coverage Assessment | Gap | Minimum Test Addition |
|---|---|---|---|---|---|
| Auth 401/403 matrix | `API_tests/auth_missing_token_401_test.sh:5`, `API_tests/authorization_matrix_test.sh:42` | Explicit status checks for protected routes and role denial | sufficient | None major | Add one regression for all admin routes in one matrix snapshot |
| OLA (order/ticket/review ownership) | `API_tests/ola_access_control_test.sh:96`, `backend/src/services/authorization/ownershipService.test.js:20` | Cross-user 404 checks + ownership unit asserts | sufficient | None major | Add media OLA join-case with mixed ownerRefs fallback |
| Atomic slot oversell protection | `API_tests/order_concurrency_test.sh:67` | Parallel order POST expects 201 + 409 with alternatives | basically covered | True DB-level race still runtime-sensitive | Add repeated-run stress script with >2 parallel actors |
| Quote validation (spec constraints/tax override) | `API_tests/quote_invalid_spec_validation_test.sh`, `unit_tests/quote_pricing_test.sh:183` | Invalid spec/tax assertions in shell and pricing unit script | basically covered | Missing API-level after-hours boundary checks | Add API test for 18:59/19:00 boundary and surcharge math |
| Review anti-fraud + moderation | `API_tests/review_duplicate_per_order_test.sh`, `API_tests/review_window_expired_test.sh`, `API_tests/review_quarantine_visibility_test.sh`, `backend/src/services/reviews/reviewsService.test.js:27` | One-review uniqueness, 14-day window, quarantine visibility, sensitive term behavior | sufficient | None major | Add API test proving approved moderation changes visibility immediately |
| Ticket SLA + immutable outcomes + attachment ownership | `API_tests/ticket_sla_fields_test.sh`, `API_tests/ticket_resolve_immutable_test.sh`, `API_tests/ticket_attachment_ownership_test.sh:63`, `backend/src/services/tickets/ticketsService.test.js:154` | Business-hour due dates, immutable outcome conflict, cross-user attachment block | sufficient | Limited coverage for timezone edge transitions | Add DST boundary SLA test fixtures |
| Media file safety (mime/header/size/dedup/ref checks) | `API_tests/media_magic_mime_validation_test.sh`, `API_tests/media_oversize_upload_test.sh`, `API_tests/media_dedup_test.sh`, `backend/src/services/media/mediaService.test.js:44` | MIME mismatch, oversize rejection, dedup behavior and delete constraints | sufficient | Missing path traversal negative API test | Add API test attempting crafted media id/path abuse |
| Internal route hardening | `API_tests/internal_routes_token_required_test.sh:7` | 403 without internal token, 200 with token+admin | sufficient | None major | Add explicit test for INTERNAL_ROUTES_ENABLED=false -> 404 |
| Search publish filtering + cleanup | `API_tests/search_published_only_test.sh`, `API_tests/search_cleanup_smoke_test.sh`, `backend/src/services/search/searchSyncService.test.js:32` | Published-only and orphan cleanup behavior | basically covered | Cleanup performance/large dataset behavior untested | Add fixture-heavy cleanup benchmark test |
| Retention legal hold policy | `API_tests/retention_legal_hold_policy_test.sh`, `API_tests/retention_cleanup_smoke_test.sh`, `backend/src/workers/retentionCleanupScheduler.test.js:6` | Legal-hold preservation and cleanup smoke | basically covered | No high-volume retention edge tests | Add multi-ticket mixed-hold dataset integration test |
| Masking non-privileged views | `API_tests/masking_profile_order_test.sh:34` | Customer masked vs staff full contact comparison | sufficient | None major | Add response contract snapshot for masking pattern |

### 8.3 Security Coverage Audit
- **Authentication:** well-covered (login success/fail, lockout, rate limit, missing token). Evidence: `run_tests.sh:97`, `run_tests.sh:104`, `run_tests.sh:105`.
- **Route authorization:** well-covered by matrix tests and middleware unit tests. Evidence: `API_tests/authorization_matrix_test.sh:42`, `backend/src/middleware/authenticate.test.js:32`.
- **Object-level authorization:** meaningfully covered for orders/tickets/reviews/media attachments. Evidence: `API_tests/ola_access_control_test.sh:96`, `API_tests/ticket_attachment_ownership_test.sh:63`.
- **Tenant/data isolation:** covered for customer-vs-staff ticket/order listing and access denial scenarios. Evidence: `API_tests/ola_access_control_test.sh:123`, `API_tests/tickets_list_test.sh`.
- **Admin/internal protection:** covered for internal token requirement and admin access assumptions. Evidence: `API_tests/internal_routes_token_required_test.sh:7`, `run_tests.sh:94`.
- **Residual risk:** despite broad tests, severe defects in long-run scheduler timing and high-concurrency races could remain undetected without runtime stress tests.

### 8.4 Final Coverage Judgment
- **Final Coverage Judgment: Partial Pass**
- Major security/business risks are broadly tested statically (authn/authz/OLA/validation/concurrency/moderation/retention), but uncovered runtime-sensitive areas (scheduler timing fidelity, stress-level race behavior, some boundary math at API level) mean tests could still pass while severe production defects remain.

## 9. Final Notes
- This report is static-only and evidence-based; runtime claims are intentionally constrained.
- The largest acceptance blockers are product-surface completeness gaps in staff console operations, not core backend logic maturity.