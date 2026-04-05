const pino = require("pino");
const pinoHttp = require("pino-http");
const crypto = require("crypto");

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.headers[\"x-internal-token\"]",
      "req.headers[\"x-csrf-token\"]",
      "req.headers[\"set-cookie\"]",
      "res.headers[\"set-cookie\"]",
      "req.body.password",
      "req.body.newPassword",
      "req.body.refreshToken",
      "req.body.accessToken",
      "req.body.token",
      "req.body.secret",
      "req.body.apiKey",
      "req.body.otp",
      "req.body.phone",
      "req.body.address",
      "req.query.token",
      "req.query.accessToken",
      "req.query.refreshToken",
      "req.query.apiKey",
      "*.password",
      "*.refreshToken",
      "*.accessToken",
      "*.token",
      "*.secret",
      "*.apiKey",
      "*.authorization",
      "*.cookie",
    ],
    censor: "[REDACTED]",
  },
});

const requestLogger = pinoHttp({
  logger,
  genReqId: (req, res) => req.headers["x-request-id"] || crypto.randomUUID(),
  customLogLevel: (req, res, err) => {
    if (err || res.statusCode >= 500) {
      return "error";
    }
    if (res.statusCode >= 400) {
      const expectedAuthFailure = req.headers["x-expected-auth-failure"] === "1";
      if (expectedAuthFailure && (res.statusCode === 401 || res.statusCode === 403)) {
        return "debug";
      }
      return "warn";
    }
    return "info";
  },
  customProps: (req, res) => ({
    requestId: req.id,
    userId: req.auth?.userId || null,
    route: req.route?.path || req.path,
    outcome: res.statusCode,
    expectedAuthFailure: req.headers["x-expected-auth-failure"] === "1",
  }),
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
});

module.exports = {
  logger,
  requestLogger,
};
