const test = require("node:test");
const assert = require("node:assert/strict");

const { extractContentMediaRefs, parseStructuredBody } = require("./contentMediaExtractor");

test("extracts media refs from structured rich-text JSON strings", () => {
  const mediaA = "507f1f77bcf86cd799439011";
  const mediaB = "507f1f77bcf86cd799439012";
  const body = JSON.stringify({
    type: "doc",
    content: [
      { type: "paragraph", text: "hello" },
      { type: "media", attrs: { mediaId: mediaA } },
      { type: "gallery", imageIds: [mediaB] },
    ],
  });

  assert.deepEqual(extractContentMediaRefs(body, []), [mediaA, mediaB]);
});

test("deduplicates refs and includes explicit media ids", () => {
  const mediaA = "507f1f77bcf86cd799439011";
  const mediaB = "507f1f77bcf86cd799439012";
  const body = {
    blocks: [{ mediaId: mediaA }, { nested: { mediaIds: [mediaA, mediaB] } }],
  };

  assert.deepEqual(extractContentMediaRefs(body, [mediaB]), [mediaB, mediaA]);
});

test("ignores plain text bodies that are not structured content", () => {
  assert.equal(parseStructuredBody("plain body with 507f1f77bcf86cd799439011 inside"), null);
  assert.deepEqual(extractContentMediaRefs("plain body with id inside", []), []);
});

test("ignores invalid JSON bodies and still keeps explicit refs", () => {
  const mediaA = "507f1f77bcf86cd799439011";
  assert.equal(parseStructuredBody('{"broken":'), null);
  assert.deepEqual(extractContentMediaRefs('{"broken":', [mediaA]), [mediaA]);
});

test("extracts nested media ids from attrs-like structures", () => {
  const mediaA = "507f1f77bcf86cd799439011";
  const mediaB = "507f1f77bcf86cd799439012";
  const body = {
    type: "doc",
    content: [
      { type: "image", attrs: { assetId: mediaA } },
      { type: "grid", attrs: { items: [{ imageIds: [mediaB] }] } },
    ],
  };

  assert.deepEqual(extractContentMediaRefs(body, []), [mediaA, mediaB]);
});
