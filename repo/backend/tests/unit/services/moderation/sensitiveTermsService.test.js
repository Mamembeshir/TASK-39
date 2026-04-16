const test = require("node:test");
const assert = require("node:assert/strict");

const {
  compileSensitiveTerms,
  containsSensitiveTerms,
  normalizeForSensitiveTermMatch,
} = require("../../../../src/services/moderation/sensitiveTermsService");

test("matches normalized sensitive terms with punctuation boundaries", () => {
  assert.equal(containsSensitiveTerms("This is fráud!", ["fraud"]), true);
  assert.equal(containsSensitiveTerms("Avoid scam, report it.", ["scam"]), true);
});

test("does not match substrings inside larger words", () => {
  assert.equal(containsSensitiveTerms("This offer is scammy", ["scam"]), false);
  assert.equal(containsSensitiveTerms("We discuss abusive language", ["abuse"]), false);
});

test("handles multi-word terms and exact plural forms distinctly", () => {
  assert.equal(containsSensitiveTerms("Known credit card fraud ring", ["credit card fraud"]), true);
  assert.equal(containsSensitiveTerms("Known scams exist", ["scam"]), false);
  assert.equal(containsSensitiveTerms("Known scams exist", ["scams"]), true);
});

test("reuses compiled pattern sets for larger term lists", () => {
  const terms = Array.from({ length: 1000 }, (_, index) => `term-${index}`);
  terms.push("fraud");
  const compiledA = compileSensitiveTerms(terms);
  const compiledB = compileSensitiveTerms([...terms]);

  assert.equal(compiledA, compiledB);
  assert.equal(normalizeForSensitiveTermMatch("Fráud"), "fraud");
  assert.equal(containsSensitiveTerms("fraud reported", terms), true);
});
