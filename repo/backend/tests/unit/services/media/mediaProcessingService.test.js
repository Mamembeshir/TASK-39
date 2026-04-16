const test = require("node:test");
const assert = require("node:assert/strict");
const sharp = require("sharp");

const { createMediaProcessingService, detectMimeFromMagicBytes } = require("../../../../src/services/media/mediaProcessingService");

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

test("maybeCompressImage applies optional crop when valid", async () => {
  const source = await sharp({
    create: {
      width: 4,
      height: 4,
      channels: 3,
      background: { r: 200, g: 100, b: 50 },
    },
  })
    .png()
    .toBuffer();

  const service = createMediaProcessingService({ mediaEnableProcessing: true });
  const cropped = await service.maybeCompressImage(source, "image/png", {
    x: 1,
    y: 1,
    width: 2,
    height: 2,
  });

  const metadata = await sharp(cropped).metadata();
  assert.equal(metadata.width, 2);
  assert.equal(metadata.height, 2);
});

test("maybeCompressImage ignores invalid crop values", async () => {
  const source = await sharp({
    create: {
      width: 4,
      height: 4,
      channels: 3,
      background: { r: 10, g: 20, b: 30 },
    },
  })
    .png()
    .toBuffer();

  const service = createMediaProcessingService({ mediaEnableProcessing: true });
  const withInvalidCrop = await service.maybeCompressImage(source, "image/png", {
    x: -1,
    y: 0,
    width: 2,
    height: 2,
  });

  const metadata = await sharp(withInvalidCrop).metadata();
  assert.equal(metadata.width, 4);
  assert.equal(metadata.height, 4);
});

test("maybeCompressImage is deterministic for same crop input", async () => {
  const source = await sharp({
    create: {
      width: 3,
      height: 3,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .png()
    .toBuffer();

  const service = createMediaProcessingService({ mediaEnableProcessing: true });
  const crop = { x: 0, y: 0, width: 2, height: 2 };
  const first = await service.maybeCompressImage(source, "image/png", crop);
  const second = await service.maybeCompressImage(source, "image/png", crop);

  assert.deepEqual(first, second);
});
