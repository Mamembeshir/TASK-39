const test = require("node:test");
const assert = require("node:assert/strict");

const { decryptField, encryptField, maskAddress, maskPhone } = require("../../src/security");

test("encryptField and decryptField round-trip plaintext", () => {
  const previousKey = process.env.FIELD_ENCRYPTION_KEY;
  process.env.FIELD_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  const encrypted = encryptField("sensitive-value");
  const decrypted = decryptField(encrypted);

  assert.equal(encrypted.alg, "aes-256-gcm");
  assert.equal(decrypted, "sensitive-value");

  process.env.FIELD_ENCRYPTION_KEY = previousKey;
});

test("encryptField returns null for empty values", () => {
  assert.equal(encryptField(null), null);
  assert.equal(encryptField(""), null);
});

test("maskPhone and maskAddress return masked forms", () => {
  assert.equal(maskPhone("+1 (555) 123-4567"), "******67");
  assert.equal(maskPhone("12"), "**");
  assert.equal(maskAddress("123 Main Street"), "123 Ma******");
  assert.equal(maskAddress("short"), "******");
});
