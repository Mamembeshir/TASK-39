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
  customProps: (req, res) => ({
    requestId: req.id,
    userId: req.auth?.userId || null,
    route: req.route?.path || req.path,
    outcome: res.statusCode,
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
