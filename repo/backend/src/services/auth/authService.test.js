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
