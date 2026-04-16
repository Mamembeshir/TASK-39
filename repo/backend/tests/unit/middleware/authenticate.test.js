process.env.NODE_ENV = "test";

const test = require("node:test");
const assert = require("node:assert/strict");

const { getClientIp, hasRole, requireCsrf, requireRole } = require("../../../src/middleware/authenticate");

function createNextRecorder() {
  const calls = [];
  const next = (value) => {
    calls.push(value);
  };
  return { calls, next };
}

test("getClientIp ignores x-forwarded-for by default", () => {
  delete process.env.TRUST_PROXY_HEADERS;
  const ip = getClientIp({ headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" }, ip: "9.9.9.9" });
  assert.equal(ip, "9.9.9.9");
});

test("getClientIp uses x-forwarded-for first entry when enabled", () => {
  process.env.TRUST_PROXY_HEADERS = "true";
  const ip = getClientIp({ headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" }, ip: "9.9.9.9" });
  assert.equal(ip, "1.2.3.4");
  delete process.env.TRUST_PROXY_HEADERS;
});

test("hasRole matches any allowed role", () => {
  assert.equal(hasRole({ auth: { roles: ["customer", "moderator"] } }, ["administrator", "moderator"]), true);
  assert.equal(hasRole({ auth: { roles: ["customer"] } }, ["administrator", "moderator"]), false);
});

test("requireRole returns unauthorized when auth is missing", () => {
  const { calls, next } = createNextRecorder();
  requireRole("administrator")({ auth: null }, {}, next);
  assert.equal(calls[0].status, 401);
  assert.equal(calls[0].code, "UNAUTHORIZED");
});

test("requireRole returns forbidden when roles do not match", () => {
  const { calls, next } = createNextRecorder();
  requireRole("administrator")({ auth: { userId: "u1", roles: ["customer"] } }, {}, next);
  assert.equal(calls[0].status, 403);
  assert.equal(calls[0].code, "FORBIDDEN");
});

test("requireRole calls next without error when role matches", () => {
  const { calls, next } = createNextRecorder();
  requireRole("administrator")({ auth: { userId: "u1", roles: ["administrator"] } }, {}, next);
  assert.deepEqual(calls, [undefined]);
});

test("requireCsrf skips auth routes", () => {
  const { calls, next } = createNextRecorder();
  requireCsrf({ path: "/api/auth/login", method: "POST", headers: {}, cookies: {} }, {}, next);
  assert.deepEqual(calls, [undefined]);
});

test("requireCsrf skips bearer token requests", () => {
  const { calls, next } = createNextRecorder();
  requireCsrf({
    path: "/api/orders",
    method: "POST",
    headers: { authorization: "Bearer token" },
    cookies: { access_token: "cookie-token" },
  }, {}, next);
  assert.deepEqual(calls, [undefined]);
});

test("requireCsrf blocks cookie-auth unsafe requests without matching csrf token", () => {
  const { calls, next } = createNextRecorder();
  requireCsrf({
    path: "/api/orders",
    method: "POST",
    headers: {},
    cookies: { access_token: "cookie-token", csrf_token: "abc" },
  }, {}, next);
  assert.equal(calls[0].status, 403);
  assert.equal(calls[0].code, "CSRF_FAILED");
});

test("requireCsrf allows cookie-auth unsafe requests with matching csrf token", () => {
  const { calls, next } = createNextRecorder();
  requireCsrf({
    path: "/api/orders",
    method: "POST",
    headers: { "x-csrf-token": "abc" },
    cookies: { access_token: "cookie-token", csrf_token: "abc" },
  }, {}, next);
  assert.deepEqual(calls, [undefined]);
});

// ─── additional coverage tests ───────────────────────────────────────────────

const jwt = require("jsonwebtoken");
const authService = require("../../../src/services/auth/authService");
const { attachOptionalAuth, requireAuth, rateLimitMiddleware } = require("../../../src/middleware/authenticate");

function signAccessToken(payload = {}) {
  // The secret is resolved once at module load; we access it by signing the same way authService does.
  // Since test-mode generates a random secret, we use authService.verifyAccessToken indirectly by
  // stubbing jwt.verify through a valid token we generate via authService's own token signer.
  return authService.signAccessToken
    ? authService.signAccessToken(payload)
    : null;
}

// Check if signAccessToken is exported; if not, stub verifyAccessToken instead.
test("attachOptionalAuth sets req.auth to null when no token present", () => {
  const req = { headers: {}, cookies: {} };
  const { calls, next } = createNextRecorder();
  attachOptionalAuth(req, {}, next);
  assert.equal(req.auth, null);
  assert.deepEqual(calls, [undefined]);
});

test("attachOptionalAuth sets req.auth to null when token verification fails", () => {
  const req = { headers: { authorization: "Bearer not-a-jwt" }, cookies: {} };
  const { calls, next } = createNextRecorder();
  attachOptionalAuth(req, {}, next);
  assert.equal(req.auth, null);
  assert.deepEqual(calls, [undefined]);
});

test("attachOptionalAuth extracts bearer token and populates req.auth on success", () => {
  const original = authService.verifyAccessToken;
  authService.verifyAccessToken = (token) => {
    assert.equal(token, "valid-token");
    return { sub: "u1", roles: ["customer"], username: "alice" };
  };
  try {
    const req = { headers: { authorization: "Bearer valid-token" }, cookies: {} };
    const { calls, next } = createNextRecorder();
    attachOptionalAuth(req, {}, next);
    assert.equal(req.auth.userId, "u1");
    assert.equal(req.auth.sub, "u1");
    assert.equal(req.auth.username, "alice");
    assert.deepEqual(req.auth.roles, ["customer"]);
    assert.deepEqual(calls, [undefined]);
  } finally {
    authService.verifyAccessToken = original;
  }
});

test("attachOptionalAuth uses cookie token when bearer not provided", () => {
  const original = authService.verifyAccessToken;
  let sawToken = null;
  authService.verifyAccessToken = (token) => {
    sawToken = token;
    return { sub: "u2", roles: [] };
  };
  try {
    const req = { headers: {}, cookies: { access_token: "cookie-token" } };
    const { calls, next } = createNextRecorder();
    attachOptionalAuth(req, {}, next);
    assert.equal(sawToken, "cookie-token");
    assert.equal(req.auth.userId, "u2");
    assert.deepEqual(calls, [undefined]);
  } finally {
    authService.verifyAccessToken = original;
  }
});

test("attachOptionalAuth ignores non-Bearer authorization scheme", () => {
  const req = { headers: { authorization: "Basic xyz" }, cookies: {} };
  const { calls, next } = createNextRecorder();
  attachOptionalAuth(req, {}, next);
  assert.equal(req.auth, null);
  assert.deepEqual(calls, [undefined]);
});

test("requireAuth rejects missing auth", () => {
  const { calls, next } = createNextRecorder();
  requireAuth({ auth: null }, {}, next);
  assert.equal(calls[0].status, 401);
  assert.equal(calls[0].code, "UNAUTHORIZED");
});

test("requireAuth passes when auth.userId present", () => {
  const { calls, next } = createNextRecorder();
  requireAuth({ auth: { userId: "u1" } }, {}, next);
  assert.deepEqual(calls, [undefined]);
});

test("rateLimitMiddleware sets headers and calls next when allowed", async () => {
  const original = authService.applyRateLimit;
  authService.applyRateLimit = async () => ({ allowed: true, limit: 100, remaining: 99, resetAt: 1700000000000 });
  try {
    const headers = {};
    const res = { setHeader: (k, v) => { headers[k] = v; } };
    const req = { auth: { userId: "u1" }, headers: {} };
    const calls = [];
    await new Promise((resolve) => {
      rateLimitMiddleware(req, res, (err) => { calls.push(err); resolve(); });
    });
    assert.deepEqual(calls, [undefined]);
    assert.equal(headers["X-RateLimit-Limit"], "100");
    assert.equal(headers["X-RateLimit-Remaining"], "99");
  } finally {
    authService.applyRateLimit = original;
  }
});

test("rateLimitMiddleware passes 429 when rate limited", async () => {
  const original = authService.applyRateLimit;
  authService.applyRateLimit = async () => ({
    allowed: false, limit: 10, remaining: 0, resetAt: 1700000000000, retryAfterSeconds: 30,
  });
  try {
    const headers = {};
    const res = { setHeader: (k, v) => { headers[k] = v; } };
    const req = { auth: null, headers: {}, ip: "1.2.3.4" };
    const calls = [];
    await new Promise((resolve) => {
      rateLimitMiddleware(req, res, (err) => { calls.push(err); resolve(); });
    });
    assert.equal(calls[0].status, 429);
    assert.equal(calls[0].code, "RATE_LIMITED");
    assert.equal(headers["Retry-After"], "30");
  } finally {
    authService.applyRateLimit = original;
  }
});

test("rateLimitMiddleware propagates errors via catch", async () => {
  const original = authService.applyRateLimit;
  authService.applyRateLimit = async () => { throw new Error("boom"); };
  try {
    const res = { setHeader() {} };
    const req = { auth: null, headers: {}, ip: "1.2.3.4" };
    const calls = [];
    await new Promise((resolve) => {
      rateLimitMiddleware(req, res, (err) => { calls.push(err); resolve(); });
    });
    assert.equal(calls[0].message, "boom");
  } finally {
    authService.applyRateLimit = original;
  }
});
