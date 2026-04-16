const test = require("node:test");
const assert = require("node:assert/strict");

const { authLoginBodySchema, authRegisterBodySchema } = require("../../../src/validators/authSchemas");

test("authRegisterBodySchema rejects weak register payloads", () => {
  const shortPassword = authRegisterBodySchema.safeParse({ username: "valid_user", password: "short" });
  assert.equal(shortPassword.success, false);

  const invalidUsername = authRegisterBodySchema.safeParse({ username: "bad name", password: "devpass123456" });
  assert.equal(invalidUsername.success, false);
});

test("authLoginBodySchema rejects unknown keys and blank usernames", () => {
  const blankUsername = authLoginBodySchema.safeParse({ username: "   ", password: "devpass123456" });
  assert.equal(blankUsername.success, false);

  const extraField = authLoginBodySchema.safeParse({
    username: "customer_demo",
    password: "devpass123456",
    ignored: true,
  });
  assert.equal(extraField.success, false);
});

test("authLoginBodySchema accepts valid credentials shape", () => {
  const valid = authLoginBodySchema.safeParse({ username: "customer_demo", password: "devpass123456" });
  assert.equal(valid.success, true);
});
