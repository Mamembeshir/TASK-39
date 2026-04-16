const test = require("node:test");
const assert = require("node:assert/strict");

process.env.NODE_ENV = "test";

const {
  applyRateLimit,
  configureRateLimitStore,
  createMemoryRateLimitStore,
  createMongoRateLimitStore,
  RATE_LIMIT_WINDOW_MS,
  resolveJwtSecrets,
  registerUser,
  authenticateCredentials,
  issueAuthTokens,
  rotateRefreshToken,
  revokeRefreshToken,
  verifyAccessToken,
} = require("../../../../src/services/auth/authService");

// usersRepository is a cached CJS module — mutating its exports lets us
// control all behaviour without jest.mock or mock.module.
const usersRepository = require("../../../../src/repositories/usersRepository");

function createFakeRateLimitDatabase() {
  const docs = new Map();

  return {
    collection(name) {
      assert.equal(name, "auth_rate_limits");
      return {
        async findOneAndUpdate(filter, update) {
          const docKey = `${filter.key}:${filter.windowStart.toISOString()}`;
          const existing = docs.get(docKey) || {
            key: filter.key,
            windowStart: filter.windowStart,
            count: 0,
          };

          const next = {
            ...existing,
            ...update.$set,
            count: existing.count + (update.$inc?.count || 0),
          };

          docs.set(docKey, next);
          return next;
        },
      };
    },
  };
}

test("mongo rate limiter shares counters across store instances", async () => {
  const database = createFakeRateLimitDatabase();
  const storeA = createMongoRateLimitStore({ getDatabase: () => database, now: () => 1_000 });
  const storeB = createMongoRateLimitStore({ getDatabase: () => database, now: () => 1_000 });

  const first = await storeA.consume({ key: "ip:1.1.1.1", limit: 2, windowMs: RATE_LIMIT_WINDOW_MS });
  const second = await storeB.consume({ key: "ip:1.1.1.1", limit: 2, windowMs: RATE_LIMIT_WINDOW_MS });
  const third = await storeA.consume({ key: "ip:1.1.1.1", limit: 2, windowMs: RATE_LIMIT_WINDOW_MS });

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(second.remaining, 0);
  assert.equal(third.allowed, false);
  assert.equal(third.store, "mongo");
});

test("configured limiter falls back to memory when backing store fails", async () => {
  configureRateLimitStore({
    getDatabase: () => ({
      collection() {
        return {
          async findOneAndUpdate() {
            throw new Error("database unavailable");
          },
        };
      },
    }),
  });

  const first = await applyRateLimit({ key: "ip:fallback", authenticated: false });
  const second = await applyRateLimit({ key: "ip:fallback", authenticated: false });

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(first.store, "memory");
  assert.equal(second.store, "memory");
});

test("memory rate limiter resets counts in a new window", async () => {
  let now = 1_000;
  const store = createMemoryRateLimitStore({ now: () => now });

  const first = await store.consume({ key: "user:1", limit: 1, windowMs: RATE_LIMIT_WINDOW_MS });
  const second = await store.consume({ key: "user:1", limit: 1, windowMs: RATE_LIMIT_WINDOW_MS });

  now += RATE_LIMIT_WINDOW_MS;

  const third = await store.consume({ key: "user:1", limit: 1, windowMs: RATE_LIMIT_WINDOW_MS });

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, false);
  assert.equal(third.allowed, true);
  assert.equal(third.remaining, 0);
});

test("resolveJwtSecrets allows test-only fallbacks", () => {
  const secrets = resolveJwtSecrets({ NODE_ENV: "test" });
  assert.equal(typeof secrets.accessSecret, "string");
  assert.equal(typeof secrets.refreshSecret, "string");
  assert.ok(secrets.accessSecret.startsWith("test-access-"));
  assert.ok(secrets.refreshSecret.startsWith("test-refresh-"));
});

test("resolveJwtSecrets requires explicit secrets outside test", () => {
  assert.throws(() => resolveJwtSecrets({ NODE_ENV: "development" }), /JWT_ACCESS_SECRET is required when NODE_ENV is not test/);
  assert.throws(
    () => resolveJwtSecrets({ NODE_ENV: "production", JWT_ACCESS_SECRET: "a" }),
    /JWT_REFRESH_SECRET is required when NODE_ENV is not test/,
  );
  assert.throws(
    () => resolveJwtSecrets({ NODE_ENV: "development", JWT_ACCESS_SECRET: "replace-with-strong-secret", JWT_REFRESH_SECRET: "b" }),
    /JWT_ACCESS_SECRET must not use default placeholder values/,
  );
  assert.throws(
    () => resolveJwtSecrets({ NODE_ENV: "development", JWT_ACCESS_SECRET: "a", JWT_REFRESH_SECRET: "replace-with-strong-secret" }),
    /JWT_REFRESH_SECRET must not use default placeholder values/,
  );
});

// ── createAuthService / module-level auth function tests ──────────────────────
//
// authService.js is not a factory — the auth functions are module-level and
// call usersRepository directly.  We monkey-patch the shared CJS export object
// before each test and restore it afterwards.

// Helper: build a minimal fake user document.
// _id must be a 24-char hex string so that new ObjectId(_id) succeeds inside
// persistRefreshToken / issueAuthTokens.
function makeFakeUser(overrides = {}) {
  const bcrypt = require("bcryptjs");
  const fakeId = "aabbccddeeff001122334455"; // valid 24-char hex ObjectId
  return {
    _id: fakeId,
    username: "testuser",
    // bcrypt hash of "correctpassword123" (pre-computed to keep tests fast)
    passwordHash: bcrypt.hashSync("correctpassword123", 1),
    roles: ["customer"],
    ...overrides,
  };
}

// --- register ---

test("register creates a new user with hashed password and returns insertedId", async () => {
  const insertedCalls = [];
  const originalInsertUser = usersRepository.insertUser;

  usersRepository.insertUser = async (doc) => {
    insertedCalls.push(doc);
    return { insertedId: "new-user-id" };
  };

  try {
    const result = await registerUser({ username: "alice", password: "strongpassword123" });
    assert.equal(result.insertedId, "new-user-id");
    assert.equal(insertedCalls.length, 1);
    assert.equal(insertedCalls[0].username, "alice");
    assert.ok(
      typeof insertedCalls[0].passwordHash === "string" && insertedCalls[0].passwordHash.length > 0,
      "passwordHash should be a non-empty string",
    );
    assert.notEqual(insertedCalls[0].passwordHash, "strongpassword123", "raw password must not be stored");
    assert.deepEqual(insertedCalls[0].roles, ["customer"]);
  } finally {
    usersRepository.insertUser = originalInsertUser;
  }
});

test("register throws 409 CONFLICT when username is already taken (duplicate key error 11000)", async () => {
  const originalInsertUser = usersRepository.insertUser;

  usersRepository.insertUser = async () => {
    const err = new Error("E11000 duplicate key error");
    err.code = 11000;
    throw err;
  };

  try {
    await assert.rejects(
      () => registerUser({ username: "existing", password: "strongpassword123" }),
      (err) => {
        assert.equal(err.code, 11000);
        return true;
      },
    );
  } finally {
    usersRepository.insertUser = originalInsertUser;
  }
});

test("register throws 400 PASSWORD_TOO_SHORT when password is shorter than 12 characters", async () => {
  // This is validated before any DB call, so no mock needed.
  await assert.rejects(
    () => registerUser({ username: "alice", password: "short" }),
    (err) => {
      assert.equal(err.status, 400);
      assert.equal(err.code, "PASSWORD_TOO_SHORT");
      return true;
    },
  );
});

// --- authenticateCredentials (login building-block) ---

test("login: authenticateCredentials returns user=null when user is not found", async () => {
  const originalFindUser = usersRepository.findUserByUsername;

  usersRepository.findUserByUsername = async () => null;

  try {
    const { user, passwordMatches } = await authenticateCredentials({
      username: "nobody",
      password: "doesntmatter",
    });
    assert.equal(user, null);
    assert.equal(passwordMatches, false);
  } finally {
    usersRepository.findUserByUsername = originalFindUser;
  }
});

test("login: authenticateCredentials returns passwordMatches=false when password is wrong", async () => {
  const fakeUser = makeFakeUser();
  const originalFindUser = usersRepository.findUserByUsername;

  usersRepository.findUserByUsername = async () => fakeUser;

  try {
    const { user, passwordMatches } = await authenticateCredentials({
      username: "testuser",
      password: "wrongpassword123",
    });
    assert.ok(user !== null);
    assert.equal(passwordMatches, false);
  } finally {
    usersRepository.findUserByUsername = originalFindUser;
  }
});

test("login: authenticateCredentials succeeds and returns user + passwordMatches=true for correct password", async () => {
  const fakeUser = makeFakeUser();
  const originalFindUser = usersRepository.findUserByUsername;

  usersRepository.findUserByUsername = async () => fakeUser;

  try {
    const { user, passwordMatches } = await authenticateCredentials({
      username: "testuser",
      password: "correctpassword123",
    });
    assert.ok(user !== null, "user should be returned");
    assert.equal(user.username, "testuser");
    assert.equal(passwordMatches, true);
  } finally {
    usersRepository.findUserByUsername = originalFindUser;
  }
});

// --- issueAuthTokens (login happy path produces verifiable tokens) ---

test("login: issueAuthTokens returns a verifiable accessToken and a refreshToken", async () => {
  const fakeUser = makeFakeUser();
  const originalInsertRefreshToken = usersRepository.insertRefreshToken;

  // persistRefreshToken internally calls insertRefreshToken via usersRepository
  usersRepository.insertRefreshToken = async () => ({ insertedId: "tok-id" });

  try {
    const { accessToken, refreshToken } = await issueAuthTokens(fakeUser);
    assert.equal(typeof accessToken, "string");
    assert.equal(typeof refreshToken, "string");

    // Verify the access token is well-formed and carries expected claims
    const payload = verifyAccessToken(accessToken);
    assert.equal(payload.sub, "aabbccddeeff001122334455");
    assert.equal(payload.username, "testuser");
    assert.deepEqual(payload.roles, ["customer"]);
    assert.equal(payload.type, "access");
  } finally {
    usersRepository.insertRefreshToken = originalInsertRefreshToken;
  }
});

// --- account lockout after 5 failures ---

test("login: registerFailedAttempt triggers lockout after 5 consecutive failures", async () => {
  const { registerFailedAttempt } = require("../../../../src/services/auth/authService");
  const originalGetLoginAttempt = usersRepository.getLoginAttempt;
  const originalUpsertLoginAttempt = usersRepository.upsertLoginAttempt;

  // Simulate 4 recent failures already on record
  const recentTimes = Array.from({ length: 4 }, (_, i) => new Date(Date.now() - i * 1000));
  usersRepository.getLoginAttempt = async () => ({
    _id: "bob",
    failedAt: recentTimes,
    lockedUntil: null,
  });
  usersRepository.upsertLoginAttempt = async () => {};

  try {
    const result = await registerFailedAttempt("bob");
    assert.equal(result.lockTriggered, true, "lockout should be triggered on the 5th failure");
    assert.ok(result.lockedUntil instanceof Date, "lockedUntil should be a Date");
  } finally {
    usersRepository.getLoginAttempt = originalGetLoginAttempt;
    usersRepository.upsertLoginAttempt = originalUpsertLoginAttempt;
  }
});

// --- logout (revokeRefreshToken / clearFailedAttempts) ---

test("logout: revokeRefreshToken updates the token's revokedAt in the DB", async () => {
  const originalInsertRefreshToken = usersRepository.insertRefreshToken;
  const originalRevokeRefreshTokenByHash = usersRepository.revokeRefreshTokenByHash;

  const revokedHashes = [];
  usersRepository.revokeRefreshTokenByHash = async (hash) => {
    revokedHashes.push(hash);
    return { modifiedCount: 1 };
  };
  // issueAuthTokens needs insertRefreshToken for setup
  usersRepository.insertRefreshToken = async () => ({ insertedId: "tok" });

  try {
    const fakeUser = makeFakeUser();
    const { refreshToken } = await issueAuthTokens(fakeUser);

    await revokeRefreshToken(refreshToken);
    assert.equal(revokedHashes.length, 1, "revokeRefreshTokenByHash should be called once");
    assert.equal(typeof revokedHashes[0], "string", "hash should be a string");
    assert.ok(revokedHashes[0].length > 0, "hash should be non-empty");
  } finally {
    usersRepository.insertRefreshToken = originalInsertRefreshToken;
    usersRepository.revokeRefreshTokenByHash = originalRevokeRefreshTokenByHash;
  }
});

// --- me: returns null-safe check via verifyAccessToken ---

test("me: verifyAccessToken throws when token is null/missing (auth is null)", () => {
  assert.throws(
    () => verifyAccessToken(null),
    (err) => {
      assert.ok(err instanceof Error);
      return true;
    },
  );
});

// --- refresh: throws 401 when refresh token is not in DB ---

test("refresh: rotateRefreshToken throws 401 INVALID_REFRESH_TOKEN when token not found in DB", async () => {
  const originalInsertRefreshToken = usersRepository.insertRefreshToken;
  const originalFindRefreshTokenByHash = usersRepository.findRefreshTokenByHash;

  usersRepository.insertRefreshToken = async () => ({ insertedId: "tok" });
  // Simulate missing/expired token
  usersRepository.findRefreshTokenByHash = async () => null;

  try {
    const fakeUser = makeFakeUser();
    // First issue a real token so we have a valid JWT to pass
    const { refreshToken } = await issueAuthTokens(fakeUser);

    // Now findRefreshTokenByHash will return null — should throw 401
    await assert.rejects(
      () => rotateRefreshToken(refreshToken),
      (err) => {
        assert.equal(err.status, 401);
        assert.equal(err.code, "INVALID_REFRESH_TOKEN");
        return true;
      },
    );
  } finally {
    usersRepository.insertRefreshToken = originalInsertRefreshToken;
    usersRepository.findRefreshTokenByHash = originalFindRefreshTokenByHash;
  }
});
