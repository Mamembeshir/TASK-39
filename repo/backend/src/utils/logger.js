const pino = require("pino");
const pinoHttp = require("pino-http");
const crypto = require("crypto");

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  redact: {
    paths: [
      "req.headers.authorization",
      "req.body.password",
      "req.body.refreshToken",
      "req.body.accessToken",
      "req.body.phone",
      "req.body.address",
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
