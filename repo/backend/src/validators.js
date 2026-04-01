const MIN_PASSWORD_LENGTH = 12;

function validatePasswordLength(password) {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      code: "PASSWORD_TOO_SHORT",
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`,
    };
  }

  return { ok: true };
}

module.exports = {
  MIN_PASSWORD_LENGTH,
  validatePasswordLength,
};
