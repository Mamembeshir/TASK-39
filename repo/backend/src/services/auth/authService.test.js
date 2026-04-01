const test = require("node:test");
const assert = require("node:assert/strict");

const {
  applyRateLimit,
  configureRateLimitStore,
  createMemoryRateLimitStore,
  createMongoRateLimitStore,
  RATE_LIMIT_WINDOW_MS,
  resolveJwtSecrets,
} = require("./authService");

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

test("resolveJwtSecrets allows development fallbacks", () => {
  const secrets = resolveJwtSecrets({ NODE_ENV: "development" });
  assert.equal(secrets.accessSecret, "dev-access-secret-change-me");
  assert.equal(secrets.refreshSecret, "dev-refresh-secret-change-me");
});

test("resolveJwtSecrets requires explicit secrets in production", () => {
  assert.throws(() => resolveJwtSecrets({ NODE_ENV: "production" }), /JWT_ACCESS_SECRET is required in production/);
  assert.throws(
    () => resolveJwtSecrets({ NODE_ENV: "production", JWT_ACCESS_SECRET: "a" }),
    /JWT_REFRESH_SECRET is required in production/,
  );
});
