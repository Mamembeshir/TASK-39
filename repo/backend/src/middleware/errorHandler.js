const multer = require("multer");
const { AppError, createAppError } = require("../errors/appError");

function toErrorResponse(error) {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return { httpStatus: 400, code: "FILE_TOO_LARGE", message: "File exceeds maximum size of 10 MB" };
    }
    if (error.code === "LIMIT_FILE_COUNT") {
      return { httpStatus: 400, code: "TOO_MANY_FILES", message: "A maximum of six files is allowed" };
    }
    return { httpStatus: 400, code: "UPLOAD_ERROR", message: error.message };
  }

  if (error instanceof AppError) {
    return {
      httpStatus: error.httpStatus,
      code: error.code,
      message: error.message,
      details: error.details,
    };
  }

  if (error && typeof error === "object" && (error.status || error.code)) {
    return {
      httpStatus: error.status || 500,
      code: error.code || "INTERNAL_ERROR",
      message: error.status ? error.message || "Request failed" : "An unexpected error occurred",
      details: error.details,
    };
  }

  return {
    httpStatus: 500,
    code: "INTERNAL_ERROR",
    message: "An unexpected error occurred",
  };
}

function errorHandler(err, req, res, next) {
  const mapped = toErrorResponse(err);
  const payload = {
    code: mapped.code,
    message: mapped.message,
  };

  if (mapped.details) {
    payload.details = mapped.details;
  }

  if (process.env.NODE_ENV !== "production" && mapped.httpStatus === 500) {
    payload.requestId = req.id || null;
  }

  return res.status(mapped.httpStatus).json(payload);
}

function validationError(details) {
  return createAppError("VALIDATION_ERROR", 400, "Request validation failed", details);
}

module.exports = {
  errorHandler,
  toErrorResponse,
  validationError,
};
