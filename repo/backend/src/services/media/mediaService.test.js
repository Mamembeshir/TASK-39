const test = require("node:test");
const assert = require("node:assert/strict");

const { createMediaService } = require("./mediaService");

function createError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

test("uploadMedia deduplicates existing media by sha256", async () => {
  let incrementedId = null;
  const service = createMediaService({
    ALLOWED_MEDIA_MIME: { "image/png": "png" },
    createError,
    detectMimeFromMagicBytes: () => "image/png",
    fs: { mkdir: async () => {}, writeFile: async () => {} },
    MAX_UPLOAD_BYTES: 10 * 1024 * 1024,
    mediaRepository: {
      findMediaBySha256: async () => ({ _id: { toString: () => "media-1" }, mime: "image/png", byteSize: 4 }),
      incrementMediaRefCount: async (id) => {
        incrementedId = id;
      },
    },
    MEDIA_ENABLE_PROCESSING: false,
    MEDIA_UPLOAD_DIR: "/tmp/uploads",
    maybeCompressImage: async (buffer) => buffer,
    ObjectId: function ObjectId(value) { this.value = value; },
  });

  const result = await service.uploadMedia({
    auth: { sub: "65f000000000000000000001" },
    purpose: "review",
    files: [{ mimetype: "image/png", buffer: Buffer.from([1, 2, 3, 4]), size: 4 }],
  });

  assert.equal(result.media[0].deduplicated, true);
  assert.equal(result.media[0].mediaId, "media-1");
  assert.ok(incrementedId);
});

test("uploadMedia rejects MIME mismatches", async () => {
  const service = createMediaService({
    ALLOWED_MEDIA_MIME: { "image/png": "png" },
    createError,
    detectMimeFromMagicBytes: () => "image/jpeg",
    fs: { mkdir: async () => {}, writeFile: async () => {} },
    MAX_UPLOAD_BYTES: 10 * 1024 * 1024,
    mediaRepository: {},
    MEDIA_ENABLE_PROCESSING: false,
    MEDIA_UPLOAD_DIR: "/tmp/uploads",
    maybeCompressImage: async (buffer) => buffer,
    ObjectId: function ObjectId(value) { this.value = value; },
  });

  await assert.rejects(
    () => service.uploadMedia({
      auth: { sub: "65f000000000000000000001" },
      purpose: "review",
      files: [{ mimetype: "image/png", buffer: Buffer.from([1, 2, 3, 4]), size: 4 }],
    }),
    (error) => error && error.code === "MIME_MISMATCH",
  );
});

test("deleteMediaById blocks deletion when references exist", async () => {
  const service = createMediaService({
    ALLOWED_MEDIA_MIME: {},
    createError,
    detectMimeFromMagicBytes: () => null,
    fs: { mkdir: async () => {}, writeFile: async () => {}, rm: async () => {} },
    MAX_UPLOAD_BYTES: 10,
    mediaRepository: {
      findMediaById: async () => ({ _id: "media-1", storagePath: "file.png" }),
      findMediaReferences: async () => ({ reviewRef: { _id: "rev-1" }, ticketRef: null, contentRef: null }),
      deleteMediaById: async () => {
        throw new Error("should not delete");
      },
    },
    MEDIA_ENABLE_PROCESSING: false,
    MEDIA_UPLOAD_DIR: "/tmp/uploads",
    maybeCompressImage: async (buffer) => buffer,
    ObjectId: function ObjectId(value) { this.value = value; },
  });

  const result = await service.deleteMediaById({ mediaId: "media-1" });
  assert.equal(result.status, 409);
  assert.equal(result.body.code, "MEDIA_IN_USE");
});
