class AppError extends Error {
  constructor({ code, httpStatus, message, details }) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
  }
}

function createAppError(code, httpStatus, message, details) {
  return new AppError({ code, httpStatus, message, details });
}

module.exports = {
  AppError,
  createAppError,
};
