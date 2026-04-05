const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { ObjectId } = require("mongodb");
const usersRepository = require("../../repositories/usersRepository");
const { validatePasswordLength } = require("../../validators");

function resolveJwtSecrets(env = process.env) {
  const nodeEnv = env.NODE_ENV || "development";
  const accessSecret = env.JWT_ACCESS_SECRET;
  const refreshSecret = env.JWT_REFRESH_SECRET;
  const defaultAccessSecret = "dev-access-secret-change-me";
  const defaultRefreshSecret = "dev-refresh-secret-change-me";
  const disallowedPlaceholders = new Set([
    defaultAccessSecret,
    defaultRefreshSecret,
    "replace-with-strong-secret",
  ]);

  if (nodeEnv === "test") {
    return {
      accessSecret: accessSecret || `test-access-${crypto.randomBytes(24).toString("hex")}`,
      refreshSecret: refreshSecret || `test-refresh-${crypto.randomBytes(24).toString("hex")}`,
    };
  }

  if (!accessSecret) {
    throw new Error("JWT_ACCESS_SECRET is required when NODE_ENV is not test");
  }
  if (!refreshSecret) {
    throw new Error("JWT_REFRESH_SECRET is required when NODE_ENV is not test");
  }
  if (disallowedPlaceholders.has(accessSecret)) {
    throw new Error("JWT_ACCESS_SECRET must not use default placeholder values");
  }
  if (disallowedPlaceholders.has(refreshSecret)) {
    throw new Error("JWT_REFRESH_SECRET must not use default placeholder values");
  }

  return {
    accessSecret,
    refreshSecret,
  };
}

const { accessSecret: ACCESS_TOKEN_SECRET, refreshSecret: REFRESH_TOKEN_SECRET } = resolveJwtSecrets();
const ACCESS_TOKEN_TTL = process.env.JWT_ACCESS_TTL || "15m";
const REFRESH_TOKEN_TTL = process.env.JWT_REFRESH_TTL || "7d";
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_THRESHOLD = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const AUTHENTICATED_LIMIT = 60;
const UNAUTHENTICATED_LIMIT = 120;

function getWindowStart(now, windowMs) {
  return now - (now % windowMs);
}

function buildRateLimitResult({ count, limit, windowStart, windowMs, store }) {
  const resetAt = windowStart + windowMs;
  return {
    allowed: count <= limit,
    limit,
    remaining: Math.max(limit - count, 0),
    resetAt,
    retryAfterSeconds: Math.max(Math.ceil((resetAt - Date.now()) / 1000), 0),
    store,
  };
}

function createMemoryRateLimitStore({ now = () => Date.now() } = {}) {
  const rateBuckets = new Map();

  return {
    mode: "memory",
    async consume({ key, limit, windowMs }) {
      const currentTime = now();
      const windowStart = getWindowStart(currentTime, windowMs);
      const existing = rateBuckets.get(key);

      if (!existing || existing.windowStart !== windowStart) {
        rateBuckets.set(key, { windowStart, count: 1 });
        return buildRateLimitResult({ count: 1, limit, windowStart, windowMs, store: "memory" });
      }

      existing.count += 1;
      return buildRateLimitResult({ count: existing.count, limit, windowStart, windowMs, store: "memory" });
    },
    reset() {
      rateBuckets.clear();
    },
  };
}

function createMongoRateLimitStore({ getDatabase, collectionName = "auth_rate_limits", now = () => Date.now() } = {}) {
  if (typeof getDatabase !== "function") {
    throw new Error("getDatabase is required for Mongo-backed rate limiting");
  }

  return {
    mode: "mongo",
    async consume({ key, limit, windowMs }) {
      const currentTime = now();
      const windowStart = getWindowStart(currentTime, windowMs);
      const expiresAt = new Date(windowStart + windowMs * 2);
      const database = getDatabase();
      const collection = database.collection(collectionName);
      const windowDate = new Date(windowStart);

      const updated = await collection.findOneAndUpdate(
        { key, windowStart: windowDate },
        {
          $inc: { count: 1 },
          $set: { updatedAt: new Date(currentTime), expiresAt },
          $setOnInsert: { createdAt: new Date(currentTime), key, windowStart: windowDate },
        },
        { upsert: true, returnDocument: "after" },
      );

      const doc = updated?.value || updated;
      const count = Number(doc?.count || 0);
      return buildRateLimitResult({ count, limit, windowStart, windowMs, store: "mongo" });
    },
  };
}

let activeRateLimitStore = createMemoryRateLimitStore();

function configureRateLimitStore({ getDatabase, preferredStore = process.env.AUTH_RATE_LIMIT_STORE || "mongo" } = {}) {
  if (preferredStore === "memory") {
    activeRateLimitStore = createMemoryRateLimitStore();
    return activeRateLimitStore;
  }

  activeRateLimitStore = createMongoRateLimitStore({ getDatabase });
  return activeRateLimitStore;
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createAccessToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      username: user.username,
      roles: user.roles,
      type: "access",
    },
    ACCESS_TOKEN_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL },
  );
}

function createRefreshToken(user, jti) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      type: "refresh",
      jti,
    },
    REFRESH_TOKEN_SECRET,
    { expiresIn: REFRESH_TOKEN_TTL },
  );
}

function verifyAccessToken(token) {
  const payload = jwt.verify(token, ACCESS_TOKEN_SECRET);
  if (payload.type !== "access") {
    throw new Error("Invalid token type");
  }
  return payload;
}

function verifyRefreshToken(refreshToken) {
  const payload = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
  if (payload.type !== "refresh") {
    throw new Error("Invalid refresh token type");
  }
  return payload;
}

async function persistRefreshToken(userId, jti, refreshToken) {
  const payload = verifyRefreshToken(refreshToken);
  const expiresAt = new Date(payload.exp * 1000);
  await usersRepository.insertRefreshToken({
    userId: new ObjectId(userId),
    jti,
    tokenHash: hashToken(refreshToken),
    expiresAt,
    revokedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

async function revokeRefreshToken(refreshToken) {
  return usersRepository.revokeRefreshTokenByHash(hashToken(refreshToken));
}

async function registerFailedAttempt(username) {
  const now = new Date();
  const windowStart = new Date(now.getTime() - LOGIN_WINDOW_MS);
  const existing = (await usersRepository.getLoginAttempt(username)) || {
    _id: username,
    failedAt: [],
    lockedUntil: null,
  };

  const recentFailures = existing.failedAt.filter(
    (value) => new Date(value).getTime() >= windowStart.getTime(),
  );
  recentFailures.push(now);

  let lockedUntil = null;
  let lockTriggered = false;
  if (recentFailures.length >= LOCKOUT_THRESHOLD) {
    lockedUntil = new Date(now.getTime() + LOGIN_WINDOW_MS);
    lockTriggered = true;
  }

  await usersRepository.upsertLoginAttempt(username, {
    failedAt: recentFailures,
    lockedUntil,
    updatedAt: now,
    createdAt: now,
  });

  return { lockTriggered, lockedUntil };
}

async function clearFailedAttempts(username) {
  await usersRepository.clearLoginAttempt(username);
}

async function verifyLoginAttemptWindow(username) {
  const attempt = await usersRepository.getLoginAttempt(username);
  if (!attempt) {
    return { locked: false, recentFailureCount: 0 };
  }
  const windowStart = Date.now() - LOGIN_WINDOW_MS;
  const recentFailureCount = (attempt.failedAt || []).filter(
    (value) => new Date(value).getTime() >= windowStart,
  ).length;
  if (!attempt.lockedUntil) {
    return { locked: false, recentFailureCount };
  }
  if (new Date(attempt.lockedUntil).getTime() > Date.now()) {
    return { locked: true, lockedUntil: new Date(attempt.lockedUntil), recentFailureCount };
  }
  return { locked: false, recentFailureCount };
}

async function registerUser({ username, password }) {
  const passwordResult = validatePasswordLength(password);
  if (!passwordResult.ok) {
    const error = new Error(passwordResult.message);
    error.status = 400;
    error.code = passwordResult.code;
    throw error;
  }

  const now = new Date();
  return usersRepository.insertUser({
    username,
    passwordHash: await bcrypt.hash(password, 10),
    roles: ["customer"],
    createdAt: now,
    updatedAt: now,
  });
}

async function authenticateCredentials({ username, password }) {
  const user = await usersRepository.findUserByUsername(username);
  const passwordMatches = user ? await bcrypt.compare(password, user.passwordHash) : false;
  return { user, passwordMatches };
}

async function issueAuthTokens(user) {
  const jti = crypto.randomUUID();
  const accessToken = createAccessToken(user);
  const refreshToken = createRefreshToken(user, jti);
  await persistRefreshToken(user._id, jti, refreshToken);
  return { accessToken, refreshToken };
}

async function rotateRefreshToken(refreshToken) {
  const payload = verifyRefreshToken(refreshToken);
  const tokenDoc = await usersRepository.findRefreshTokenByHash(hashToken(refreshToken));
  if (!tokenDoc || tokenDoc.expiresAt.getTime() <= Date.now()) {
    const error = new Error("Refresh token is invalid");
    error.status = 401;
    error.code = "INVALID_REFRESH_TOKEN";
    throw error;
  }

  const user = await usersRepository.findUserById(payload.sub);
  if (!user) {
    const error = new Error("User not found");
    error.status = 401;
    error.code = "UNAUTHORIZED";
    throw error;
  }

  await revokeRefreshToken(refreshToken);
  return issueAuthTokens(user);
}

async function applyRateLimit({ key, authenticated }) {
  const limit = authenticated ? AUTHENTICATED_LIMIT : UNAUTHENTICATED_LIMIT;
  try {
    return await activeRateLimitStore.consume({
      key,
      limit,
      windowMs: RATE_LIMIT_WINDOW_MS,
    });
  } catch (error) {
    if (activeRateLimitStore.mode !== "memory") {
      activeRateLimitStore = createMemoryRateLimitStore();
      return activeRateLimitStore.consume({ key, limit, windowMs: RATE_LIMIT_WINDOW_MS });
    }
    throw error;
  }
}

module.exports = {
  AUTHENTICATED_LIMIT,
  UNAUTHENTICATED_LIMIT,
  RATE_LIMIT_WINDOW_MS,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
  registerFailedAttempt,
  clearFailedAttempts,
  verifyLoginAttemptWindow,
  registerUser,
  authenticateCredentials,
  issueAuthTokens,
  rotateRefreshToken,
  revokeRefreshToken,
  applyRateLimit,
  configureRateLimitStore,
  createMemoryRateLimitStore,
  createMongoRateLimitStore,
  resolveJwtSecrets,
};
