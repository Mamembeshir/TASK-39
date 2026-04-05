const test = require("node:test");
const assert = require("node:assert/strict");

const { getClientIp, hasRole, requireCsrf, requireRole } = require("./authenticate");

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
