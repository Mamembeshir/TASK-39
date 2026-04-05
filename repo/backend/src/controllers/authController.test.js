const test = require("node:test");
const assert = require("node:assert/strict");

const { createAuthController } = require("./authController");

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
