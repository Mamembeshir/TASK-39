const test = require("node:test");
const assert = require("node:assert/strict");

const { createRouteAuthorizer } = require("./authorizeRoute");

function createNextRecorder() {
  const calls = [];
  return {
    calls,
    next(value) {
      calls.push(value);
    },
  };
}

test("route authorizer skips non-api paths and unmatched policies", () => {
  const requireAuth = () => {};
  const requireRole = () => () => {};
  const authorizer = createRouteAuthorizer([{ method: "GET", path: "/api/orders", auth: "user" }], requireAuth, requireRole);

  const first = createNextRecorder();
  authorizer({ path: "/health", method: "GET" }, {}, first.next);
  assert.deepEqual(first.calls, [undefined]);

  const second = createNextRecorder();
  authorizer({ path: "/api/unknown", method: "GET" }, {}, second.next);
  assert.deepEqual(second.calls, [undefined]);
});

test("route authorizer uses requireAuth for user routes", () => {
  let authCalls = 0;
  const requireAuth = (req, res, next) => {
    authCalls += 1;
    next();
  };
  const requireRole = () => () => {};
  const authorizer = createRouteAuthorizer([{ method: "GET", path: "/api/orders/:id", auth: "user" }], requireAuth, requireRole);

  const recorder = createNextRecorder();
  authorizer({ path: "/api/orders/123", method: "GET" }, {}, recorder.next);

  assert.equal(authCalls, 1);
  assert.deepEqual(recorder.calls, [undefined]);
});

test("route authorizer maps staff route to administrator and service_manager roles", () => {
  const requireAuth = () => {};
  let capturedRoles = null;
  const requireRole = (...roles) => {
    capturedRoles = roles;
    return (req, res, next) => next();
  };
  const authorizer = createRouteAuthorizer([{ method: "POST", path: "/api/staff/services", auth: "staff" }], requireAuth, requireRole);

  const recorder = createNextRecorder();
  authorizer({ path: "/api/staff/services", method: "POST" }, {}, recorder.next);

  assert.deepEqual(capturedRoles, ["administrator", "service_manager"]);
  assert.deepEqual(recorder.calls, [undefined]);
});

test("route authorizer maps administrator auth type to administrator role", () => {
  const requireAuth = () => {};
  let capturedRoles = null;
  const requireRole = (...roles) => {
    capturedRoles = roles;
    return (req, res, next) => next();
  };
  const authorizer = createRouteAuthorizer([{ method: "GET", path: "/api/admin/audit", auth: "administrator" }], requireAuth, requireRole);

  const recorder = createNextRecorder();
  authorizer({ path: "/api/admin/audit", method: "GET" }, {}, recorder.next);

  assert.deepEqual(capturedRoles, ["administrator"]);
  assert.deepEqual(recorder.calls, [undefined]);
});

test("route authorizer maps ticket_dispute_staff to moderator-inclusive staff roles", () => {
  const requireAuth = () => {};
  let capturedRoles = null;
  const requireRole = (...roles) => {
    capturedRoles = roles;
    return (req, res, next) => next();
  };
  const authorizer = createRouteAuthorizer(
    [{ method: "POST", path: "/api/tickets/:id/resolve", auth: "ticket_dispute_staff" }],
    requireAuth,
    requireRole,
  );

  const recorder = createNextRecorder();
  authorizer({ path: "/api/tickets/123/resolve", method: "POST" }, {}, recorder.next);

  assert.deepEqual(capturedRoles, ["administrator", "service_manager", "moderator"]);
  assert.deepEqual(recorder.calls, [undefined]);
});

test("route authorizer returns policy config error for invalid auth types", () => {
  const requireAuth = () => {};
  const requireRole = () => () => {};
  const authorizer = createRouteAuthorizer([{ method: "GET", path: "/api/bad", auth: "weird" }], requireAuth, requireRole);

  const recorder = createNextRecorder();
  authorizer({ path: "/api/bad", method: "GET" }, {}, recorder.next);

  assert.equal(recorder.calls[0].status, 500);
  assert.equal(recorder.calls[0].code, "POLICY_CONFIG_ERROR");
});
