#!/bin/sh

NODE_ENV=production node -e '
const { errorHandler } = require("./backend/src/middleware/errorHandler");

const req = { id: "req-test" };
let statusCode = 0;
let payload = null;
const res = {
  status(code) {
    statusCode = code;
    return this;
  },
  json(body) {
    payload = body;
    return this;
  },
};

const err = new Error("boom");
err.stack = "SHOULD_NOT_LEAK";
errorHandler(err, req, res, () => {});

const ok = statusCode === 500 && payload && !Object.prototype.hasOwnProperty.call(payload, "stack") && payload.code === "INTERNAL_ERROR";
process.exit(ok ? 0 : 1);
'
