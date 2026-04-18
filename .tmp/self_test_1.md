# HomeCareOps Static Audit Report (Delivery Acceptance + Architecture)

## 1. Verdict
- Overall conclusion: **Partial Pass**

## 2. Scope and Static Verification Boundary
- Reviewed: repository structure, README/docs, backend/ frontend source, route registration, auth/authz middleware, core services (catalog/quote/order/review/ticket/content/media/search/retention), and static test assets (`README.md:1`, `backend/src/app.core.js:1`, `frontend/src/app/router.tsx:1`, `run_tests.sh:1`).
- Not reviewed: runtime behavior under real execution, browser rendering, DB state transitions in a running environment, container orchestration behavior.
- Intentionally not executed: project startup, Docker, API tests, unit tests, frontend tests (per audit boundary).
- Manual verification required for: actual UI rendering quality, true runtime performance/concurrency behavior, scheduler timing under live process lifecycle, TLS certificate/trust behavior in real client environments.

## 3. Repository / Requirement Mapping Summary
- Prompt core mapped: customer marketplace flow (catalog -> detail/spec -> quote -> checkout -> orders -> reviews/tickets), role-based consoles, moderation/inbox/content workflows, deterministic server-side pricing, capacity/slot protection, media and retention/search/security controls.
- Main implementation areas mapped: backend route/middleware/services/repositories (`backend/src/bootstrap/registerRoutes.js:24`, `backend/src/services/*`), frontend route/features (`frontend/src/app/router.tsx:48`, `frontend/src/features/*`), static test harness (`run_tests.sh:93`).
- Major constraints checked: offline-local architecture (React + Express + Mongo), local media storage, role/access controls, lockout/rate limiting/TLS-at-rest encryption claims.

## 4. Section-by-section Review

### 1. Hard Gates

#### 1.1 Documentation and static verifiability
- Conclusion: **Partial Pass**
- Rationale: startup/config instructions exist, but docs contain material mismatch on DB seeding behavior and do not clearly provide a non-Docker test invocation path in README.
- Evidence: `README.md:35`, `README.md:157`, `backend/src/db.js:58`, `backend/src/db.js:47`, `run_tests.sh:7`.
- Manual verification note: none.

#### 1.2 Material deviation from Prompt
- Conclusion: **Partial Pass**
- Rationale: implementation is strongly centered on the Prompt, but key customer checkout/validation UX requirements are materially degraded by frontend-backend contract mismatches.
- Evidence: `backend/src/pricing.js:283`, `backend/src/controllers/customerController.js:238`, `frontend/src/features/orders/pages/CheckoutPage.tsx:278`, `backend/src/services/orders/ordersService.js:196`, `frontend/src/features/orders/pages/CheckoutPage.tsx:159`.
- Manual verification note: manual browser check needed to confirm end-user impact severity at runtime.

### 2. Delivery Completeness

#### 2.1 Core explicit requirements coverage
- Conclusion: **Partial Pass**
- Rationale: most core requirements are implemented (pricing, capacity, reviews, tickets, inbox, content, media, search, role consoles), but core quote/checkout feedback paths are inconsistent in UI due data-shape mismatch.
- Evidence: `backend/src/pricing.js:99`, `backend/src/services/orders/ordersService.js:194`, `backend/src/services/reviews/reviewsService.js:71`, `backend/src/services/tickets/ticketsService.js:121`, `backend/src/services/inbox/inboxService.js:47`, `backend/src/services/content/contentService.js:213`, `backend/src/services/media/mediaService.js:75`, `frontend/src/features/catalog/pages/ServiceDetailPage.tsx:314`.
- Manual verification note: runtime confirmation required for final UX correctness.

#### 2.2 End-to-end 0->1 deliverable completeness
- Conclusion: **Pass**
- Rationale: full-stack structure is present with backend, frontend, docs, scripts, API/static test assets; not a fragment/demo-only drop.
- Evidence: `backend/package.json:1`, `frontend/package.json:1`, `README.md:12`, `run_tests.sh:93`, `API_tests/order_concurrency_test.sh:1`.
- Manual verification note: none.

### 3. Engineering and Architecture Quality

#### 3.1 Structure and module decomposition
- Conclusion: **Partial Pass**
- Rationale: substantial modular decomposition exists (routes/controllers/services/repositories), but `app.core.js` remains a large orchestration hotspot and some architecture docs are stale against current codebase shape.
- Evidence: `backend/src/app.core.js:1`, `backend/src/bootstrap/registerRoutes.js:24`, `backend/src/services/README.md:1`, `backend/src/controllers/README.md:1`.
- Manual verification note: none.

#### 3.2 Maintainability/extensibility
- Conclusion: **Pass**
- Rationale: core logic generally centralized and extensible (ownership service, route policy, repositories, workers, validators); not hardcoded single-flow only.
- Evidence: `backend/src/services/authorization/ownershipService.js:24`, `backend/src/config/routePolicies.js:1`, `backend/src/middleware/validate.js:56`, `backend/src/workers/contentPublishScheduler.js:39`.
- Manual verification note: none.

### 4. Engineering Details and Professionalism

#### 4.1 Error handling, logging, validation, API design
- Conclusion: **Partial Pass**
- Rationale: strong baseline (structured errors, zod validation, audit and request logs, redaction), but API/client error-contract mismatch drops actionable alternatives in checkout conflict path.
- Evidence: `backend/src/middleware/errorHandler.js:40`, `backend/src/middleware/validate.js:27`, `backend/src/utils/logger.js:7`, `backend/src/services/orders/ordersService.js:196`, `frontend/src/api/client.ts:30`, `frontend/src/features/orders/pages/CheckoutPage.tsx:159`.
- Manual verification note: none.

#### 4.2 Product/service maturity vs demo
- Conclusion: **Pass**
- Rationale: contains coherent role consoles, domain entities, moderation/dispute workflows, scheduling workers, and persistence model typical of productized service.
- Evidence: `frontend/src/app/router.tsx:87`, `backend/src/services/tickets/ticketsService.js:303`, `backend/src/services/content/contentService.js:244`, `backend/src/services/media/mediaService.js:147`.
- Manual verification note: none.

### 5. Prompt Understanding and Requirement Fit

#### 5.1 Business-goal and constraints fit
- Conclusion: **Partial Pass**
- Rationale: business scenario is broadly understood and implemented, but customer-facing real-time quote/alternative-slot experience does not fully reflect Prompt intent due integration defects.
- Evidence: `frontend/src/features/catalog/pages/ServiceDetailPage.tsx:84`, `frontend/src/features/orders/pages/CheckoutPage.tsx:137`, `backend/src/services/orders/ordersService.js:171`, `frontend/src/api/client.ts:153`.
- Manual verification note: manual UX walkthrough required to quantify end-user friction.

### 6. Aesthetics (frontend)

#### 6.1 Visual/interaction design quality
- Conclusion: **Cannot Confirm Statistically**
- Rationale: code indicates structured layouts, spacing, and interaction states, but static code review cannot verify rendered visual quality, alignment correctness, or responsive fidelity.
- Evidence: `frontend/src/features/catalog/pages/CatalogPage.tsx:62`, `frontend/src/features/booking/pages/ComparePage.tsx:191`, `frontend/src/features/inbox/pages/InboxPage.tsx:35`.
- Manual verification note: browser-based desktop/mobile visual QA required.

## 5. Issues / Suggestions (Severity-Rated)

### Blocker / High

1) **Severity: High**  
**Title:** Quote response contract mismatch breaks real-time price/tax validation UX  
**Conclusion:** Fail  
**Evidence:** `backend/src/pricing.js:283`, `backend/src/controllers/customerController.js:238`, `frontend/src/features/catalog/pages/ServiceDetailPage.tsx:314`, `frontend/src/features/orders/pages/CheckoutPage.tsx:278`, `frontend/src/features/booking/api/bookingApi.ts:41`  
**Impact:** frontend expects top-level `total`/`taxBreakdown`, while backend returns nested `totals.total` and no `taxBreakdown`; user-facing real-time price feedback can be missing/incorrect in core flow.  
**Minimum actionable fix:** align API contract and client mapping (either return frontend-expected shape or map backend shape to UI model in `bookingApi.ts`).

2) **Severity: High**  
**Title:** Actionable alternative slots lost in checkout conflict handling  
**Conclusion:** Fail  
**Evidence:** `backend/src/services/orders/ordersService.js:196`, `backend/src/services/orders/ordersService.js:142`, `frontend/src/api/client.ts:30`, `frontend/src/api/client.ts:153`, `frontend/src/features/orders/pages/CheckoutPage.tsx:159`  
**Impact:** backend returns `alternatives` for `SLOT_UNAVAILABLE`/`SLOT_SERVICE_MISMATCH`, but client error normalization drops that field; checkout cannot reliably present suggested alternatives required by Prompt.  
**Minimum actionable fix:** preserve structured error payload fields (including `alternatives`) in `toApiError`, or move alternatives under `details` consistently server-side and consume that in checkout.

### Medium

3) **Severity: Medium**  
**Title:** README seeding claim conflicts with implemented startup behavior  
**Conclusion:** Partial Fail  
**Evidence:** `README.md:35`, `README.md:157`, `backend/src/db.js:58`, `backend/.env.example:2`  
**Impact:** static verifiability degraded; reviewer/operator may assume fixtures are always present, causing failed verification attempts.  
**Minimum actionable fix:** update README to state seeding is opt-in (`SEED_FIXTURES=true`) and differentiate dev/test fixture paths.

4) **Severity: Medium**  
**Title:** Weak JWT fallback secrets can be used in non-production environments  
**Conclusion:** Suspected Risk  
**Evidence:** `backend/src/services/auth/authService.js:22`, `backend/src/services/auth/authService.js:27`, `docker-compose.yml:23`  
**Impact:** predictable secrets in LAN/offline deployments raise token forgery risk if environment escapes trusted boundary.  
**Minimum actionable fix:** require explicit secrets in all environments except explicit test mode, or hard-fail startup when defaults are detected outside CI/test.

5) **Severity: Medium**  
**Title:** Architecture documentation sections are stale against current modularized code  
**Conclusion:** Partial Fail  
**Evidence:** `backend/src/services/README.md:1`, `backend/src/controllers/README.md:1`, `backend/src/routes/README.md:1`, `backend/src/bootstrap/registerRoutes.js:1`  
**Impact:** maintainability and onboarding friction; documented module state no longer matches real structure.  
**Minimum actionable fix:** replace placeholder README files with current module responsibilities and dependency boundaries.

### Low

6) **Severity: Low**  
**Title:** README lacks first-class test execution guidance for non-Docker static reviewers  
**Conclusion:** Partial Pass  
**Evidence:** `README.md:12`, `run_tests.sh:7`, `backend/package.json:8`, `frontend/package.json:10`  
**Impact:** verification discoverability is lower despite existing test assets.  
**Minimum actionable fix:** add a concise "Test" section in root README with unit/API/frontend commands and environment preconditions.

## 6. Security Review Summary

- **Authentication entry points:** **Pass**; login/register/refresh/logout/me endpoints and token verification are explicit (`backend/src/routes/auth.routes.js:6`, `backend/src/middleware/authenticate.js:56`, `backend/src/services/auth/authService.js:149`).
- **Route-level authorization:** **Pass**; centralized policy + route guards across API surface (`backend/src/config/routePolicies.js:1`, `backend/src/middleware/authorizeRoute.js:48`, `backend/src/bootstrap/registerRoutes.js:151`).
- **Object-level authorization:** **Pass**; ownership checks centralized and applied to orders/tickets/review submit (`backend/src/services/authorization/ownershipService.js:24`, `backend/src/services/orders/ordersService.js:249`, `backend/src/services/tickets/ticketsService.js:222`, `backend/src/services/reviews/reviewsService.js:64`).
- **Function-level authorization:** **Partial Pass**; core protected actions guarded, but security posture still depends on environment hardening (e.g., weak default JWT secrets). (`backend/src/routes/admin.routes.js:5`, `backend/src/routes/internal.routes.js:9`, `backend/src/services/auth/authService.js:22`).
- **Tenant/user data isolation:** **Pass**; customer-scoped queries and ownership guards enforce per-user visibility, with 404 anti-enumeration behavior (`backend/src/repositories/ordersRepository.js:66`, `backend/src/services/authorization/ownershipService.js:37`, `backend/src/services/tickets/ticketsService.js:199`).
- **Admin/internal/debug protection:** **Pass**; admin role guards and test-only internal routes with shared token are enforced (`backend/src/bootstrap/registerRoutes.js:282`, `backend/src/bootstrap/registerRoutes.js:295`, `backend/src/routes/internal.routes.js:5`).

## 7. Tests and Logging Review

- **Unit tests:** **Pass**; extensive backend node tests exist across middleware/services/validators (`backend/package.json:8`, `backend/src/services/orders/ordersService.test.js:1`, `backend/src/middleware/authenticate.test.js:1`).
- **API/integration tests:** **Pass**; broad shell-based API suite maps many core/security flows (`run_tests.sh:93`, `API_tests/authorization_matrix_test.sh:41`, `API_tests/order_concurrency_test.sh:67`).
- **Logging categories/observability:** **Pass**; structured request logs + audit logs + scheduler logging present (`backend/src/utils/logger.js:20`, `backend/src/services/audit/auditService.js:80`, `backend/src/workers/retentionCleanupScheduler.js:46`).
- **Sensitive-data leakage risk (logs/responses):** **Partial Pass**; request logger redacts major sensitive fields, but headers/body fields outside redaction list may still be logged depending on extensions. (`backend/src/utils/logger.js:8`, `backend/src/middleware/errorHandler.js:42`).

## 8. Test Coverage Assessment (Static Audit)

### 8.1 Test Overview
- Unit tests exist (Node test runner for backend, Vitest for frontend): `backend/package.json:8`, `frontend/package.json:10`.
- API/integration tests exist as shell scripts orchestrated by `run_tests.sh`: `run_tests.sh:93`.
- Test entry points are explicit: backend `test:unit`, frontend `test`, integration `run_tests.sh`: `backend/package.json:8`, `frontend/package.json:10`, `run_tests.sh:1`.
- Documentation of test commands is only partial at root README level; discovery is mostly script/package-based: `README.md:12`, `run_tests.sh:152`.

### 8.2 Coverage Mapping Table

| Requirement / Risk Point | Mapped Test Case(s) | Key Assertion / Fixture / Mock | Coverage Assessment | Gap | Minimum Test Addition |
|---|---|---|---|---|---|
| Login lockout after 5 failed attempts | `API_tests/auth_lockout_test.sh:16` | 6th login must return `423` + `ACCOUNT_LOCKED` (`API_tests/auth_lockout_test.sh:31`) | sufficient | none material | add lockout-expiry recovery test |
| Route auth (401/403 matrix) | `API_tests/authorization_matrix_test.sh:41` | no-token 401 and customer-token 403 on privileged routes (`API_tests/authorization_matrix_test.sh:58`) | sufficient | does not cover every endpoint | add generated route-policy parity test |
| Object-level authorization (orders/tickets/reviews) | `API_tests/ola_access_control_test.sh:96` | cross-user access returns 404 (`API_tests/ola_access_control_test.sh:123`, `API_tests/ola_access_control_test.sh:141`) | sufficient | limited to customer roles | add staff/moderator OLA edge tests |
| Capacity atomicity under concurrent order create | `API_tests/order_concurrency_test.sh:67` | one 201 + one 409 with `SLOT_UNAVAILABLE` and alternatives (`API_tests/order_concurrency_test.sh:86`) | basically covered | static-only cannot prove race exhaustively | add repeated multi-run stress test |
| Quote validation for invalid spec options | `API_tests/quote_invalid_spec_validation_test.sh:16` | invalid headcount/tools/add-on -> 400 + specific error codes (`API_tests/quote_invalid_spec_validation_test.sh:40`) | sufficient | no happy-path payload-shape assertion | add quote schema contract test |
| One review per order | `API_tests/review_duplicate_per_order_test.sh:28` | second submit returns 409 `REVIEW_ALREADY_EXISTS` (`API_tests/review_duplicate_per_order_test.sh:42`) | sufficient | none material | add db-unique-index assertion test |
| Review 14-day window | `API_tests/review_window_expired_test.sh:31` | stale `completedAt` then submit -> `REVIEW_WINDOW_EXPIRED` (`API_tests/review_window_expired_test.sh:64`) | sufficient | depends on fixture manipulation | add boundary-day (day 14 end-of-day) test |
| Quarantine sensitive-term review visibility | `API_tests/review_quarantine_visibility_test.sh:39` | quarantined review not returned in public list (`API_tests/review_quarantine_visibility_test.sh:55`) | sufficient | moderation-approval transition not in same test | add quarantine->approve visibility transition test |
| Internal route hardening | `API_tests/internal_routes_token_required_test.sh:1` | (via runner) requires token and auth | basically covered | no negative test for non-test NODE_ENV in runtime suite | add startup-fail test for `INTERNAL_ROUTES_ENABLED=true` outside test env |
| Retention policy + legal hold | `API_tests/retention_legal_hold_policy_test.sh:1` | (via runner) cleanup honors legal hold | basically covered | not all attachment-reference permutations | add referenced-media refCount safety test |
| Search cleanup orphan removal | `API_tests/search_cleanup_smoke_test.sh:1` | smoke verifies cleanup execution path | insufficient | no strong assertions for orphan detection correctness | add deterministic fixture with expected removals |
| Logging/redaction behavior | `unit_tests/production_error_no_stack_test.sh:1` | production error payload omits stack | insufficient | no direct test for pino redaction fields | add logger redaction contract test |

### 8.3 Security Coverage Audit
- **authentication:** **sufficiently covered** by login, wrong-password, lockout, token-required tests (`run_tests.sh:97`, `run_tests.sh:103`, `run_tests.sh:104`).
- **route authorization:** **sufficiently covered** for critical route matrix (`run_tests.sh:100`, `API_tests/authorization_matrix_test.sh:41`).
- **object-level authorization:** **sufficiently covered** for key customer isolation paths (`run_tests.sh:101`, `API_tests/ola_access_control_test.sh:96`).
- **tenant/data isolation:** **basically covered** for order/ticket/review ownership, but broader cross-role data-access matrix could still miss edge leaks (`API_tests/ola_access_control_test.sh:129`).
- **admin/internal protection:** **basically covered** via internal token-required/admin tests, but startup-level misconfiguration guard coverage is limited (`run_tests.sh:94`, `backend/src/bootstrap/registerRoutes.js:283`).

### 8.4 Final Coverage Judgment
- **Partial Pass**
- Major auth/authz/OLA/happy-path risk areas are covered by static test assets; however, uncovered contract-level frontend-backend mismatches (quote shape, conflict alternatives propagation) show severe defects could remain while many backend tests still pass.

## 9. Final Notes
- This is a static-only audit; runtime claims are intentionally limited.
- The highest-value fixes are contract alignment between quote/order conflict APIs and frontend consumers.
- Security baseline is solid, but environment-hardening defaults (JWT secret policy) should be tightened to reduce accidental weak deployments.