process.env.NODE_ENV = "test";
const test = require("node:test");
const assert = require("node:assert/strict");

const { createAuthController } = require("../../../src/controllers/authController");

function createError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function createRes() {
  return {
    statusCode: 200,
    body: null,
    cookies: [],
    clearedCookies: [],
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    cookie(name, value, options) {
      this.cookies.push({ name, value, options });
    },
    clearCookie(name, options) {
      this.clearedCookies.push({ name, options });
    },
  };
}

test("auth responses do not expose access or refresh tokens", async () => {
  const controller = createAuthController({
    authService: {
      registerUser: async () => ({ insertedId: { toString: () => "user-1" } }),
      issueAuthTokens: async () => ({ accessToken: "access-1", refreshToken: "refresh-1" }),
      verifyLoginAttemptWindow: async () => ({ locked: false, recentFailureCount: 0 }),
      authenticateCredentials: async () => ({
        user: { _id: { toString: () => "user-1" }, username: "demo", roles: ["customer"] },
        passwordMatches: true,
      }),
      clearFailedAttempts: async () => {},
      rotateRefreshToken: async () => ({ accessToken: "access-2", refreshToken: "refresh-2" }),
      revokeRefreshToken: async () => {},
    },
    createError,
    getDatabase: () => ({
      collection(name) {
        if (name !== "user_devices" && name !== "users") {
          throw new Error(`unexpected collection ${name}`);
        }
        return {
          async countDocuments() {
            return 0;
          },
          async updateOne() {
            return { upsertedCount: 0 };
          },
          async findOne() {
            return { username: "demo", roles: ["customer"] };
          },
        };
      },
    }),
    getDeviceFingerprint: () => "device-1",
    writeAuditLog: async () => {},
    assessLoginRisk: () => ({ category: "low" }),
    ObjectId: function ObjectId(value) { this.value = value; this.toString = () => String(value); },
  });

  const registerRes = createRes();
  await controller.register({ body: { username: "demo", password: "secret" } }, registerRes, (error) => { throw error; });
  assert.equal(registerRes.statusCode, 201);
  assert.deepEqual(registerRes.body, { user: { id: "user-1", username: "demo", roles: ["customer"] } });
  assert.equal(registerRes.body.accessToken, undefined);
  assert.equal(registerRes.body.refreshToken, undefined);

  const loginRes = createRes();
  await controller.login(
    { body: { username: "demo", password: "secret" }, headers: { "user-agent": "unit-test" }, ip: "127.0.0.1" },
    loginRes,
    (error) => { throw error; },
  );
  assert.equal(loginRes.statusCode, 200);
  assert.deepEqual(loginRes.body.user, { id: "user-1", username: "demo", roles: ["customer"] });
  assert.equal(loginRes.body.accessToken, undefined);
  assert.equal(loginRes.body.refreshToken, undefined);

  const refreshRes = createRes();
  await controller.refresh(
    { cookies: { refresh_token: "refresh-1" }, auth: { sub: "user-1", username: "demo", roles: ["customer"] } },
    refreshRes,
    (error) => { throw error; },
  );
  assert.equal(refreshRes.statusCode, 200);
  assert.deepEqual(refreshRes.body, { user: { id: "user-1", username: "demo", roles: ["customer"] } });
  assert.equal(refreshRes.body.accessToken, undefined);
  assert.equal(refreshRes.body.refreshToken, undefined);
});

function makeDeps(overrides = {}) {
  const base = {
    authService: {
      registerUser: async () => ({ insertedId: { toString: () => "user-1" } }),
      issueAuthTokens: async () => ({ accessToken: "a", refreshToken: "r" }),
      verifyLoginAttemptWindow: async () => ({ locked: false, recentFailureCount: 0 }),
      authenticateCredentials: async () => ({
        user: { _id: { toString: () => "user-1" }, username: "demo", roles: ["customer"] },
        passwordMatches: true,
      }),
      clearFailedAttempts: async () => {},
      registerFailedAttempt: async () => ({ lockTriggered: false }),
      rotateRefreshToken: async () => ({ accessToken: "a2", refreshToken: "r2" }),
      revokeRefreshToken: async () => {},
    },
    createError,
    getDatabase: () => ({
      collection: () => ({
        countDocuments: async () => 0,
        updateOne: async () => ({ upsertedCount: 0 }),
        findOne: async () => ({ username: "demo", roles: ["customer"] }),
      }),
    }),
    getDeviceFingerprint: () => "dev",
    writeAuditLog: async () => {},
    assessLoginRisk: () => ({ category: "low" }),
    ObjectId: function ObjectId(v) { this.v = v; this.toString = () => String(v); },
  };
  return { ...base, ...overrides, authService: { ...base.authService, ...(overrides.authService || {}) } };
}

test("register rejects missing username with 400 via next", async () => {
  const c = createAuthController(makeDeps());
  const res = createRes();
  const errs = [];
  await c.register({ body: {} }, res, (e) => errs.push(e));
  assert.equal(errs.length, 1);
  assert.equal(errs[0].code, "INVALID_USERNAME");
});

test("register returns 409 on duplicate username", async () => {
  const c = createAuthController(makeDeps({ authService: {
    registerUser: async () => { const e = new Error("dup"); e.code = 11000; throw e; },
  }}));
  const res = createRes();
  const errs = [];
  await c.register({ body: { username: "x", password: "y" } }, res, (e) => errs.push(e));
  assert.equal(errs[0].code, "USERNAME_TAKEN");
});

test("register forwards generic errors to next", async () => {
  const c = createAuthController(makeDeps({ authService: {
    registerUser: async () => { throw new Error("boom"); },
  }}));
  const res = createRes();
  const errs = [];
  await c.register({ body: { username: "x", password: "y" } }, res, (e) => errs.push(e));
  assert.equal(errs[0].message, "boom");
});

test("login requires username and password", async () => {
  const c = createAuthController(makeDeps());
  const res = createRes();
  const errs = [];
  await c.login({ body: { username: "x" }, headers: {}, ip: "" }, res, (e) => errs.push(e));
  assert.equal(errs[0].code, "INVALID_CREDENTIALS");
});

test("login returns ACCOUNT_LOCKED when window locked", async () => {
  const c = createAuthController(makeDeps({ authService: {
    verifyLoginAttemptWindow: async () => ({ locked: true, recentFailureCount: 5 }),
  }}));
  const res = createRes();
  const errs = [];
  await c.login({ body: { username: "x", password: "p" }, headers: {}, ip: "" }, res, (e) => errs.push(e));
  assert.equal(errs[0].code, "ACCOUNT_LOCKED");
});

test("login with bad password returns 401", async () => {
  const c = createAuthController(makeDeps({ authService: {
    authenticateCredentials: async () => ({ user: null, passwordMatches: false }),
    registerFailedAttempt: async () => ({ lockTriggered: false }),
  }}));
  const res = createRes();
  const errs = [];
  await c.login({ body: { username: "x", password: "p" }, headers: {}, ip: "" }, res, (e) => errs.push(e));
  assert.equal(errs[0].code, "INVALID_CREDENTIALS");
});

test("login triggers lockout when failure threshold reached", async () => {
  const c = createAuthController(makeDeps({ authService: {
    authenticateCredentials: async () => ({ user: null, passwordMatches: false }),
    registerFailedAttempt: async () => ({ lockTriggered: true }),
  }}));
  const res = createRes();
  const errs = [];
  await c.login({ body: { username: "x", password: "p" }, headers: {}, ip: "" }, res, (e) => errs.push(e));
  assert.equal(errs[0].code, "ACCOUNT_LOCKED");
});

test("login reports new device security event", async () => {
  const c = createAuthController(makeDeps({
    getDatabase: () => ({
      collection: () => ({
        countDocuments: async () => 2,
        updateOne: async () => ({ upsertedCount: 1 }),
      }),
    }),
    assessLoginRisk: () => ({ category: "high", score: 80 }),
  }));
  const res = createRes();
  await c.login({ body: { username: "x", password: "p" }, headers: { "user-agent": "ua" }, ip: "1.2.3.4" }, res, () => {});
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.securityEvent.type, "new_device_login");
});

test("login swallows device-tracking errors", async () => {
  const c = createAuthController(makeDeps({
    getDatabase: () => ({
      collection: () => ({
        countDocuments: async () => { throw new Error("db down"); },
        updateOne: async () => ({ upsertedCount: 0 }),
      }),
    }),
  }));
  const res = createRes();
  await c.login({ body: { username: "x", password: "p" }, headers: {}, ip: "" }, res, () => {});
  assert.equal(res.statusCode, 200);
});

test("login forwards thrown errors to next", async () => {
  const c = createAuthController(makeDeps({ authService: {
    verifyLoginAttemptWindow: async () => { throw new Error("svc"); },
  }}));
  const errs = [];
  await c.login({ body: { username: "x", password: "p" }, headers: {}, ip: "" }, createRes(), (e) => errs.push(e));
  assert.equal(errs[0].message, "svc");
});

test("refresh without cookie returns REFRESH_TOKEN_REQUIRED", async () => {
  const c = createAuthController(makeDeps());
  const errs = [];
  await c.refresh({ cookies: {}, body: {} }, createRes(), (e) => errs.push(e));
  assert.equal(errs[0].code, "REFRESH_TOKEN_REQUIRED");
});

test("refresh wraps rotation errors with code/status", async () => {
  const c = createAuthController(makeDeps({ authService: {
    rotateRefreshToken: async () => { const e = new Error("bad"); e.status = 401; e.code = "INVALID_REFRESH_TOKEN"; throw e; },
  }}));
  const errs = [];
  await c.refresh({ cookies: { refresh_token: "t" } }, createRes(), (e) => errs.push(e));
  assert.equal(errs[0].code, "INVALID_REFRESH_TOKEN");
});

test("refresh returns null user when unauthenticated", async () => {
  const c = createAuthController(makeDeps());
  const res = createRes();
  await c.refresh({ cookies: { refresh_token: "t" } }, res, () => {});
  assert.equal(res.body.user, null);
});

test("logout clears cookies and revokes refresh token", async () => {
  let revoked = null;
  const c = createAuthController(makeDeps({ authService: {
    revokeRefreshToken: async (t) => { revoked = t; },
  }}));
  const res = createRes();
  await c.logout({ cookies: { refresh_token: "tok" }, auth: { username: "demo", sub: "abc" }, headers: {} }, res, () => {});
  assert.equal(res.statusCode, 200);
  assert.equal(revoked, "tok");
  assert.ok(res.clearedCookies.length >= 3);
});

test("logout succeeds with no auth context", async () => {
  const c = createAuthController(makeDeps());
  const res = createRes();
  await c.logout({ cookies: {}, headers: {} }, res, () => {});
  assert.deepEqual(res.body, { status: "ok" });
});

test("logout forwards errors to next", async () => {
  const c = createAuthController(makeDeps({ authService: {
    revokeRefreshToken: async () => { throw new Error("boom"); },
  }}));
  const errs = [];
  await c.logout({ cookies: { refresh_token: "t" }, headers: {} }, createRes(), (e) => errs.push(e));
  assert.equal(errs[0].message, "boom");
});

test("me returns current user", async () => {
  const c = createAuthController(makeDeps({
    getDatabase: () => ({ collection: () => ({ findOne: async () => ({ username: "demo", roles: ["customer"] }) }) }),
  }));
  const res = createRes();
  await c.me({ auth: { sub: "user-1" } }, res, () => {});
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.user.username, "demo");
});

test("me returns 401 when user missing", async () => {
  const c = createAuthController(makeDeps({
    getDatabase: () => ({ collection: () => ({ findOne: async () => null }) }),
  }));
  const errs = [];
  await c.me({ auth: { sub: "user-1" } }, createRes(), (e) => errs.push(e));
  assert.equal(errs[0].code, "UNAUTHORIZED");
});

