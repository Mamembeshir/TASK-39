# HomeCareOps — Design

Project root: `repo/`  
Frontend: React (Vite) in `repo/frontend/`  
Backend: Express + MongoDB in `repo/backend/`

## 1) Goal and scope

HomeCareOps is an **offline-capable home-service marketplace + knowledge hub** running on localhost/LAN:

- Customers browse/filter services, configure specs, compare/favorite, and place orders only if capacity remains.
- Staff (Administrators / Service Managers / Moderators) operate consoles for catalog, ops slots, content publishing, and moderation/disputes.

Prompt-fit evidence map (high level): `repo/docs/ARCHITECTURE-TARGET.md:16-73`

## 2) High-level architecture

### 2.1 Frontend (React)

Feature modules live under `repo/frontend/src/features/`:

- Catalog + service detail (bundles/specs/Q&A/reviews)
- Booking (favorites/compare/quote inputs)
- Orders (checkout + order detail)
- Tickets (complaints/SLA)
- Inbox (announcements + role-targeted messages)
- Consoles: Admin, Ops, Mod

API access is centralized via `repo/frontend/src/api/client.ts` (enforced by `check:fetch` script in `repo/frontend/package.json`).

### 2.2 Backend (Express)

The backend is layered to keep responsibilities clear:

- **Routes / Controllers**: define HTTP surface and map to services
- **Services**: core business logic (pricing/quote, orders/capacity, reviews/moderation, tickets/SLA, inbox, content, media)
- **Repositories**: DB access wrappers
- **Middleware**: auth, route authorization policy, validation, error handling, blacklist, rate limiting, CSRF

Route access control is centralized and declarative in `repo/backend/src/config/routePolicies.js`.

Note: `repo/backend/src/app.core.js` intentionally remains a large “behavior-freeze” module during refactor to preserve HTTP contracts while boundaries are introduced incrementally.

## 3) Core domain flows

### 3.1 Browse → quote → checkout

1. Customer lists services with filters (category/tags/spec filters).
2. Customer configures specs (duration/headcount/tools/add-ons) and optionally selects bundles.
3. Customer requests a **server-side quote** (deterministic pricing).
4. Checkout validates:
   - travel zone serviceability
   - pricing stability (quote signature)
   - slot capacity availability

Key rules are implemented server-side in `repo/backend/src/pricing.js` and exposed via `/api/quote`.

### 3.2 Pricing rules (deterministic)

Pricing is computed server-side as:

- Base + duration adjustments
- Headcount adjustment
- Tools mode adjustment (provider vs customer)
- Add-on adjustment
- Travel fee by miles band:
  - 0–10 miles: $0
  - 10–20 miles: $15
  - >20 miles: not serviceable
- Same-day priority surcharge:
  - +$25 only if `sameDayPriority=true` and slot starts within 4 hours
- After-hours surcharge:
  - 1.5× labor rate for minutes between 7:00 PM–7:00 AM (implemented as +50% for after-hours minutes)
- Tax is jurisdiction-driven via `jurisdictionId` (applies only when jurisdiction requires tax)

Source of truth: `repo/backend/src/pricing.js`

### 3.3 Capacity enforcement (no oversell)

Capacity is enforced with an **atomic decrement** on the slot document:

- If decrement fails (capacity is 0), API returns `409 SLOT_UNAVAILABLE` and suggested alternatives.

Atomic decrement implementation: `repo/backend/src/repositories/ordersRepository.js`  
Conflict response behavior: `repo/backend/src/services/orders/ordersService.js`

### 3.4 Reviews + moderation

Reviews are gated to “verified purchase only” by enforcing:

- ownership (order.customerId matches actor)
- order must be completed
- one review per order (unique constraint handling → 409)
- 14-day review window
- tags restricted to predefined IDs
- up to 6 images, 10MB each, image type allowlist, magic-byte header validation
- sensitive terms quarantine until moderator approves

Source of truth: `repo/backend/src/services/reviews/reviewsService.js`, `repo/backend/src/services/media/mediaService.js`

### 3.5 Tickets (complaints) + SLA + immutable outcome

Tickets:

- route by category to a deterministic team/queue
- compute SLA deadlines (first response 8 business hours; resolution target 5 business days)
- immutable resolution outcome archiving
- legal-hold support + retention cleanup after 365 days when eligible

Source of truth: `repo/backend/src/services/tickets/ticketsService.js`, `repo/backend/src/scripts/retentionCleanup.js`

### 3.6 Knowledge hub content (versioned)

Content supports:

- draft updates
- scheduled publish
- publish
- rollback to prior version
- dependency checks: embedded media must exist and match purpose

Source of truth: `repo/backend/src/services/content/contentService.js`

## 4) Security model (LAN-first)

### 4.1 Authentication

- Username/password login
- JWT access + refresh tokens
- Lockout after 5 failed attempts for 15 minutes

### 4.2 Authorization

- Route-level RBAC via `routePolicies`
- Object-level authorization centralized in `repo/backend/src/services/authorization/ownershipService.js`
- Ownership-protected resources use **404** for “missing or not allowed” to reduce existence leakage

### 4.3 Defense-in-depth

- Request-shape hardening: rejects `$`-prefixed and dotted keys in params/query/body
- CSRF required when using auth cookies for unsafe methods; bearer-token callers bypass CSRF
- Rate limiting with stable headers
- Structured logs with redaction of sensitive fields
- At-rest encryption (AES-256-GCM) for sensitive profile fields + masking for non-privileged views

Security overview: `repo/docs/SECURITY.md`

## 5) Data model (MongoDB collections)

Primary collections (non-exhaustive):

`users`, `services`, `bundles`, `capacity_slots`, `orders`, `reviews`, `tickets`, `messages`, `content_versions`, `media_metadata`, `search_documents`, `audit_logs`, `settings`, `jurisdictions`, `blacklists`

Collection touch map: `repo/docs/ARCHITECTURE-TARGET.md:74-106`

## 6) Operational jobs / scripts

- Weekly search cleanup scheduler (configurable)
- Manual scripts:
  - `npm --prefix repo/backend run search:cleanup`
  - `npm --prefix repo/backend run retention:cleanup`

Source: `repo/backend/src/scripts/searchCleanup.js`, `repo/backend/src/scripts/retentionCleanup.js`
