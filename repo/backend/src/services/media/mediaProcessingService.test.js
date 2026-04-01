const test = require("node:test");
const assert = require("node:assert/strict");

const { createMediaProcessingService, detectMimeFromMagicBytes } = require("./mediaProcessingService");

test("detectMimeFromMagicBytes identifies common image formats", () => {
  assert.equal(detectMimeFromMagicBytes(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
  assert.equal(detectMimeFromMagicBytes(Buffer.from([0x89, 0x50, 0x4e, 0x47])), "image/png");
  assert.equal(detectMimeFromMagicBytes(Buffer.from([0x47, 0x49, 0x46, 0x38])), "image/gif");
  assert.equal(
    detectMimeFromMagicBytes(Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])),
    "image/webp",
  );
});

test("detectMimeFromMagicBytes returns null for unknown data", () => {
  assert.equal(detectMimeFromMagicBytes(Buffer.from([0x00, 0x01, 0x02, 0x03])), null);
  assert.equal(detectMimeFromMagicBytes(Buffer.from([0x89, 0x50])), null);
});

test("maybeCompressImage is a no-op when processing is disabled", async () => {
  const service = createMediaProcessingService({ mediaEnableProcessing: false });
  const buffer = Buffer.from("plain-bytes");
  const result = await service.maybeCompressImage(buffer, "image/png");
  assert.equal(result, buffer);
});
