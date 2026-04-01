const test = require("node:test");
const assert = require("node:assert/strict");
const multer = require("multer");

const { AppError } = require("../errors/appError");
const { errorHandler, toErrorResponse, validationError } = require("./errorHandler");

test("toErrorResponse maps multer size errors", () => {
  const error = new multer.MulterError("LIMIT_FILE_SIZE");
  assert.deepEqual(toErrorResponse(error), {
    httpStatus: 400,
    code: "FILE_TOO_LARGE",
    message: "File exceeds maximum size of 10 MB",
  });
});

test("toErrorResponse preserves AppError fields", () => {
  const error = new AppError({
    code: "BAD",
    httpStatus: 422,
    message: "Bad input",
    details: [{ field: "x", message: "nope" }],
  });
  assert.deepEqual(toErrorResponse(error), {
    httpStatus: 422,
    code: "BAD",
    message: "Bad input",
    details: [{ field: "x", message: "nope" }],
  });
});

test("validationError creates standardized validation app error", () => {
  const error = validationError([{ field: "body.name", message: "Required" }]);
  assert.equal(error.code, "VALIDATION_ERROR");
  assert.equal(error.httpStatus, 400);
  assert.equal(error.message, "Request validation failed");
});

test("errorHandler includes requestId only for non-production 500 errors", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";

  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };

  errorHandler(new Error("boom"), { id: "req-1" }, res);

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.code, "INTERNAL_ERROR");
  assert.equal(res.body.requestId, "req-1");

  process.env.NODE_ENV = previousNodeEnv;
});

test("errorHandler omits requestId in production", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";

  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };

  errorHandler(new Error("boom"), { id: "req-1" }, res);

  assert.equal(res.statusCode, 500);
  assert.equal("requestId" in res.body, false);

  process.env.NODE_ENV = previousNodeEnv;
});
