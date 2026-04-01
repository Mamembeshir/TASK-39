function compilePathPattern(pathPattern) {
  const escaped = pathPattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/:(\w+)/g, "[^/]+");
  return new RegExp(`^${escaped}$`);
}

function buildPolicyMatcher(routePolicies) {
  return routePolicies.map((policy) => ({
    ...policy,
    method: policy.method.toUpperCase(),
    regex: compilePathPattern(policy.path),
  }));
}

function policyToMiddleware(auth, requireAuth, requireRole) {
  if (auth === "public") {
    return (req, res, next) => next();
  }
  if (auth === "user") {
    return requireAuth;
  }
  if (auth === "customer") {
    return requireRole("customer");
  }
  if (auth === "staff") {
    return requireRole("administrator", "service_manager");
  }
  if (auth === "moderation") {
    return requireRole("moderator", "administrator");
  }
  if (auth === "message_staff") {
    return requireRole("administrator", "service_manager", "moderator");
  }
  if (auth === "administrator") {
    return requireRole("administrator");
  }

  return (req, res, next) => {
    const error = new Error("Route policy auth type is invalid");
    error.status = 500;
    error.code = "POLICY_CONFIG_ERROR";
    next(error);
  };
}

function createRouteAuthorizer(routePolicies, requireAuth, requireRole) {
  const matchers = buildPolicyMatcher(routePolicies);

  return (req, res, next) => {
    if (!req.path.startsWith("/api/")) {
      return next();
    }

    const method = req.method.toUpperCase();
    const policy = matchers.find((item) => item.method === method && item.regex.test(req.path));
    if (!policy) {
      return next();
    }

    const middleware = policyToMiddleware(policy.auth, requireAuth, requireRole);
    return middleware(req, res, next);
  };
}

module.exports = {
  createRouteAuthorizer,
};
