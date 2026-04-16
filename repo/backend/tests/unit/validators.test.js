const test = require("node:test");
const assert = require("node:assert/strict");

const { MIN_PASSWORD_LENGTH, validatePasswordLength } = require("../../src/validators");

test("validatePasswordLength accepts passwords at minimum length", () => {
  const password = "x".repeat(MIN_PASSWORD_LENGTH);
  assert.deepEqual(validatePasswordLength(password), { ok: true });
});

test("validatePasswordLength rejects short and non-string values", () => {
  assert.deepEqual(validatePasswordLength("short"), {
    ok: false,
    code: "PASSWORD_TOO_SHORT",
    message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`,
  });
  assert.deepEqual(validatePasswordLength(null), {
    ok: false,
    code: "PASSWORD_TOO_SHORT",
    message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`,
  });
});
