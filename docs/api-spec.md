# HomeCareOps — API Specification (REST)

Project root: `repo/`  
Backend: `repo/backend` (Express)

This document describes the **implemented** HTTP API surface (not a theoretical design).  
Authoritative route policy list: `repo/backend/src/config/routePolicies.js`

## 1) Conventions

### 1.1 Base URL

- HTTP: `http://localhost:4000`
- HTTPS (optional): `https://localhost:4000` when TLS is enabled

Health:

- `GET /api/health` → `{ "status": "ok" }`

### 1.2 Auth

Two supported modes:

- **Bearer token**: `Authorization: Bearer <accessToken>`
- **HTTP-only cookies**: `access_token`, `refresh_token` (CSRF required for unsafe methods when using cookies)

Roles:

- `customer`
- `administrator`
- `service_manager`
- `moderator`

Route auth policy types (as used in `routePolicies`):

- `public`, `user`, `customer`, `staff`, `moderation`, `message_staff`, `administrator`

### 1.3 Error format

Errors return standard HTTP status codes and JSON:

```json
{ "code": "SOME_CODE", "message": "Human readable message", "details": [] }
```

Source of truth: `repo/backend/src/middleware/errorHandler.js`

### 1.4 Rate limiting

All requests pass through rate limiting and include:

- `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

Source of truth: `repo/backend/src/middleware/authenticate.js` + `repo/backend/src/services/auth/authService.js`

## 2) Endpoint index (by area)

The list below is the implemented route surface and minimum auth requirement.

### 2.1 Health

- `GET /api/health` (public)

### 2.2 Auth

- `POST /api/auth/register` (public)
- `POST /api/auth/login` (public)
- `POST /api/auth/refresh` (public)
- `POST /api/auth/logout` (public)
- `GET /api/auth/me` (user)

### 2.3 Profile

- `PUT /api/profile/contact` (user)
- `GET /api/profile/me` (user)

### 2.4 Catalog + Search

- `GET /api/services` (public)
- `GET /api/services/:id` (public; unpublished hidden unless staff bearer)
- `GET /api/services/:id/questions` (public)
- `POST /api/services/:id/questions` (customer)
- `GET /api/services/:id/reviews` (public)
- `GET /api/search` (public)

### 2.5 Favorites + Compare

- `POST /api/favorites/:serviceId` (customer)
- `DELETE /api/favorites/:serviceId` (customer)
- `GET /api/favorites` (customer)
- `PUT /api/compare` (customer; max 5 services)
- `GET /api/compare` (customer)

### 2.6 Quote

- `GET /api/quote/jurisdictions` (customer)
- `GET /api/quote/slots` (customer)
- `POST /api/quote` (customer)

### 2.7 Orders + Ops slots

- `POST /api/orders` (customer)
- `GET /api/orders` (customer)
- `GET /api/orders/:id` (user; owner/staff enforced via OLA)
- `POST /api/orders/:id/cancel` (user; owner/staff enforced via OLA)

- `GET /api/staff/orders/slots` (staff)
- `POST /api/staff/orders/slots` (staff)
- `POST /api/staff/orders/slots/:id` (staff)
- `DELETE /api/staff/orders/slots/:id` (staff)
- `POST /api/staff/orders/:id/complete` (staff)

### 2.8 Content (knowledge hub)

- `GET /api/content` (public)
- `GET /api/content/:id` (public)
- `GET /api/content/manage` (staff)
- `POST /api/content` (staff)
- `PATCH /api/content/:id/draft` (staff)
- `POST /api/content/:id/schedule` (staff)
- `POST /api/content/:id/publish` (staff)
- `GET /api/content/:id/versions` (staff)
- `POST /api/content/:id/rollback` (staff)

### 2.9 Media

- `POST /api/media` (user) — multipart form:
  - `purpose=review|ticket|content`
  - `files=@...` (up to 6, max 10MB each, images only)
- `DELETE /api/media/:id` (user)

### 2.10 Reviews moderation

- `POST /api/reviews` (customer)
- `GET /api/moderation/reviews` (moderation)
- `POST /api/moderation/reviews/:id/approve` (moderation)
- `POST /api/moderation/reviews/:id/reject` (moderation)

### 2.11 Tickets (complaints)

- `POST /api/tickets` (user; ownership enforced)
- `GET /api/tickets` (user; staff sees all)
- `GET /api/tickets/:id` (user; ownership enforced)
- `POST /api/tickets/:id/status` (user; ownership enforced; immutable outcome blocks changes)
- `POST /api/tickets/:id/legal-hold` (staff)
- `POST /api/tickets/:id/resolve` (staff; creates immutable outcome)

### 2.12 Inbox + Staff messages

- `GET /api/inbox` (user)
- `POST /api/inbox/:id/read` (user)
- `POST /api/staff/messages` (message_staff)

### 2.13 Admin

- `GET /api/admin/audit` (administrator)
- `GET /api/admin/blacklist` (administrator)
- `POST /api/admin/blacklist` (administrator)

## 3) Selected request/response examples

### 3.1 Login

Request:

```http
POST /api/auth/login
Content-Type: application/json

{"username":"customer_demo","password":"devpass123456"}
```

Response: 200 with tokens and user object (also sets auth cookies).

### 3.2 Quote (same-day priority + travel + tax)

```http
POST /api/quote
Authorization: Bearer <token>
Content-Type: application/json

{
  "lineItems":[{"type":"service","serviceId":"<id>","durationMinutes":60,"quantity":1,"spec":{"headcount":1,"toolsMode":"provider","addOnIds":[]}}],
  "slotStart":"2026-04-10T18:00:00.000Z",
  "bookingRequestedAt":"2026-04-10T16:30:00.000Z",
  "milesFromDepot":15,
  "jurisdictionId":"US-OR-PDX",
  "sameDayPriority":true
}
```

Notes:

- If `milesFromDepot > 20` → `notServiceable=true` and totals are zero.
- If invalid spec (headcount/tools/add-on) → 400 with a specific error code.

Pricing source: `repo/backend/src/pricing.js`

### 3.3 Order creation conflict (slot unavailable)

When capacity is exhausted, order creation returns 409 with suggested alternatives.

Source: `repo/backend/src/services/orders/ordersService.js` + atomic decrement in `repo/backend/src/repositories/ordersRepository.js`

## 4) Security notes (API consumers)

- Use Bearer tokens for API tooling and tests; cookies are used by the browser app.
- When using cookies, include `X-CSRF-Token` header matching `csrf_token` cookie for unsafe methods.

Source: `repo/backend/src/middleware/authenticate.js`
