# Security Overview

## Auth

- Access/refresh JWT flow with centralized bearer parsing and verification middleware.
- `req.auth` is attached after successful token verification.
- Missing or invalid tokens return `401` with stable `UNAUTHORIZED` code.

## RBAC

- Route authorization policies are declared in `backend/src/config/routePolicies.js`.
- Policy middleware enforces minimum role before route handlers execute.
- Standard role groups: `customer`, `staff` (`administrator`, `service_manager`), `moderation`, `message_staff`.

## OLA

- Ownership/row-level checks are centralized in `backend/src/services/authorization/ownershipService.js`.
- Services/handlers use actor context `{ userId, roles }` from token, never from request body.
- Ownership-protected reads/writes return `404` for both missing and unauthorized rows to reduce existence leakage.

## Validation

- Edge validation is applied via middleware (`backend/src/middleware/validate.js`) backed by Zod.
- Validation failures return `400` with:
  - `code: VALIDATION_ERROR`
  - `details: [{ field, message }]`
- Operator-like keys (e.g. `$where`, dotted keys) are rejected from request params/query/body.

## Headers

- `helmet` is enabled for standard security headers (content type sniffing, frame protections, etc.).
- CORS uses env allowlist (`CORS_ALLOWLIST`) and does not use wildcard origins with credentialed mode.

## Logging

- Structured request logging uses `pino`/`pino-http` with request id, route, outcome, and user id when available.
- Sensitive fields are redacted (passwords, tokens, raw contact PII).

## Known Limitations

- TLS is local self-signed for development and LAN testing; trust/bootstrap is manual.
- Key rotation for encrypted at-rest fields is not implemented in this prompt series.
- IP-based controls rely on forwarded headers in local/proxy setup; production hardening requires trusted proxy configuration.
