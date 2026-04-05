const authService = require("../services/auth/authService");

function parseAuthorizationToken(req) {
  const header = req.headers.authorization;
  if (!header || typeof header !== "string") {
    return null;
  }

  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }
  return token;
}

function parseCookieToken(req, name) {
  const value = req.cookies?.[name];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function toBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }
  return String(value).toLowerCase() === "true";
}

function parseForwardedIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded !== "string" || forwarded.length === 0) {
    return null;
  }

  const firstHop = forwarded.split(",")[0].trim();
  return firstHop.length > 0 ? firstHop : null;
}

function getClientIp(req) {
  const trustProxyHeaders = toBoolean(process.env.TRUST_PROXY_HEADERS, false);
  if (trustProxyHeaders) {
    const forwarded = parseForwardedIp(req);
    if (forwarded) {
      return forwarded;
    }
  }
  return req.ip || "unknown";
}

function createError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function attachOptionalAuth(req, res, next) {
  const token = parseCookieToken(req, 'access_token') || parseAuthorizationToken(req);
  if (!token) {
    req.auth = null;
    return next();
  }

  try {
    const payload = authService.verifyAccessToken(token);
    req.auth = {
      userId: payload.sub,
      roles: payload.roles || [],
      username: payload.username || null,
      sub: payload.sub,
      ...payload,
    };
  } catch (error) {
    req.auth = null;
  }

  return next();
}

function requireCsrf(req, res, next) {
  if (req.path.startsWith('/api/auth/')) {
    return next();
  }

  const unsafeMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (!unsafeMethods.includes(req.method.toUpperCase())) {
    return next();
  }

  const hasBearerToken = Boolean(parseAuthorizationToken(req));
  const hasAuthCookies = Boolean(parseCookieToken(req, 'access_token') || parseCookieToken(req, 'refresh_token'));
  if (hasBearerToken || !hasAuthCookies) {
    return next();
  }

  const csrfCookie = parseCookieToken(req, 'csrf_token');
  const csrfHeader = req.headers['x-csrf-token'];
  if (!csrfCookie || typeof csrfHeader !== 'string' || csrfHeader !== csrfCookie) {
    return next(createError(403, 'CSRF_FAILED', 'CSRF validation failed'));
  }

  return next();
}

function requireAuth(req, res, next) {
  if (!req.auth || !req.auth.userId) {
    return next(createError(401, "UNAUTHORIZED", "Authorization required"));
  }
  return next();
}

function hasRole(req, allowedRoles) {
  const roles = req.auth?.roles || [];
  return roles.some((role) => allowedRoles.includes(role));
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.auth || !req.auth.userId) {
      return next(createError(401, "UNAUTHORIZED", "Authorization required"));
    }
    if (!hasRole(req, roles)) {
      return next(createError(403, "FORBIDDEN", "Insufficient permissions"));
    }
    return next();
  };
}

function rateLimitMiddleware(req, res, next) {
  const key = req.auth?.userId ? `user:${req.auth.userId}` : `ip:${getClientIp(req)}`;
  authService
    .applyRateLimit({ key, authenticated: Boolean(req.auth?.userId) })
    .then((result) => {
      res.setHeader("X-RateLimit-Limit", String(result.limit));
      res.setHeader("X-RateLimit-Remaining", String(result.remaining));
      res.setHeader("X-RateLimit-Reset", String(Math.floor(result.resetAt / 1000)));
      if (!result.allowed) {
        res.setHeader("Retry-After", String(result.retryAfterSeconds));
        return next(createError(429, "RATE_LIMITED", "Rate limit exceeded. Please try again later."));
      }
      return next();
    })
    .catch(next);
}

module.exports = {
  attachOptionalAuth,
  requireAuth,
  requireRole,
  hasRole,
  rateLimitMiddleware,
  getClientIp,
  requireCsrf,
};
