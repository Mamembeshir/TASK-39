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
    ObjectId: function ObjectId(value) { this.value = value; this.toString = () => String(value); },
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

test("uploadMedia rejects public media purposes for non-staff users", async () => {
  const service = createMediaService({
    ALLOWED_MEDIA_MIME: { "image/png": "png" },
    createError,
    detectMimeFromMagicBytes: () => "image/png",
    fs: { mkdir: async () => {}, writeFile: async () => {} },
    MAX_UPLOAD_BYTES: 10 * 1024 * 1024,
    mediaRepository: {},
    MEDIA_ENABLE_PROCESSING: false,
    MEDIA_UPLOAD_DIR: "/tmp/uploads",
    maybeCompressImage: async (buffer) => buffer,
    ObjectId: function ObjectId(value) { this.value = value; this.toString = () => String(value); },
  });

  await assert.rejects(
    () => service.uploadMedia({
      auth: { sub: "65f000000000000000000001", roles: [{ toString: () => "customer" }] },
      purpose: "content",
      files: [{ mimetype: "image/png", buffer: Buffer.from([1, 2, 3, 4]), size: 4 }],
    }),
    (error) => error && error.code === "FORBIDDEN_MEDIA_PURPOSE" && error.status === 403,
  );
});

test("uploadMedia keeps public and private hashes in separate namespaces", async () => {
  const lookups = [];
  const inserted = [];
  const service = createMediaService({
    ALLOWED_MEDIA_MIME: { "image/png": "png" },
    createError,
    detectMimeFromMagicBytes: () => "image/png",
    fs: { mkdir: async () => {}, writeFile: async () => {} },
    MAX_UPLOAD_BYTES: 10 * 1024 * 1024,
    mediaRepository: {
      findMediaBySha256: async (sha256, dedupNamespace) => {
        lookups.push({ sha256, dedupNamespace });
        if (dedupNamespace === "review") {
          return {
            _id: { toString: () => "private-media" },
            mime: "image/png",
            byteSize: 4,
            purpose: "review",
            storageScope: "private",
            storagePath: "private/private-media.png",
          };
        }
        return null;
      },
      incrementMediaRefCount: async () => {},
      insertMedia: async (doc) => {
        inserted.push(doc);
        return { insertedId: { toString: () => "public-media" } };
      },
      findAndIncrementBySha256: async () => {
        throw new Error("should not use fallback dedup path");
      },
    },
    MEDIA_ENABLE_PROCESSING: false,
    MEDIA_UPLOAD_DIR: "/tmp/uploads",
    maybeCompressImage: async (buffer) => buffer,
    ObjectId: function ObjectId(value) { this.value = value; this.toString = () => String(value); },
  });

  const privateResult = await service.uploadMedia({
    auth: { sub: "65f000000000000000000001", roles: ["customer"] },
    purpose: "review",
    files: [{ mimetype: "image/png", buffer: Buffer.from([1, 2, 3, 4]), size: 4 }],
  });

  const publicResult = await service.uploadMedia({
    auth: { sub: "65f000000000000000000001", roles: ["moderator"] },
    purpose: "public_asset",
    files: [{ mimetype: "image/png", buffer: Buffer.from([1, 2, 3, 4]), size: 4 }],
  });

  assert.equal(privateResult.media[0].deduplicated, true);
  assert.equal(privateResult.media[0].mediaId, "private-media");
  assert.equal(privateResult.media[0].url, "/api/media/files/private-media");
  assert.equal(publicResult.media[0].deduplicated, false);
  assert.equal(publicResult.media[0].mediaId, "public-media");
  assert.equal(publicResult.media[0].url.startsWith("/media/files/public/"), true);
  assert.equal(publicResult.media[0].url.endsWith(".png"), true);
  assert.deepEqual(lookups.map((entry) => entry.dedupNamespace), ["review", "public_asset"]);
  assert.equal(inserted[0].storageScope, "public");
  assert.equal(inserted[0].dedupNamespace, "public_asset");
});

test("uploadMedia uses the deduped document from duplicate-key recovery", async () => {
  const service = createMediaService({
    ALLOWED_MEDIA_MIME: { "image/png": "png" },
    createError,
    detectMimeFromMagicBytes: () => "image/png",
    fs: { mkdir: async () => {}, writeFile: async () => {} },
    MAX_UPLOAD_BYTES: 10 * 1024 * 1024,
    mediaRepository: {
      findMediaBySha256: async () => null,
      insertMedia: async () => {
        const error = new Error("duplicate");
        error.code = 11000;
        throw error;
      },
      findAndIncrementBySha256: async () => ({
        _id: { toString: () => "dedup-media" },
        mime: "image/png",
        byteSize: 4,
        purpose: "review",
        storageScope: "private",
        storagePath: "private/dedup-media.png",
      }),
    },
    MEDIA_ENABLE_PROCESSING: false,
    MEDIA_UPLOAD_DIR: "/tmp/uploads",
    maybeCompressImage: async (buffer) => buffer,
    ObjectId: function ObjectId(value) { this.value = value; this.toString = () => String(value); },
  });

  const result = await service.uploadMedia({
    auth: { sub: "65f000000000000000000001", roles: ["customer"] },
    purpose: "review",
    files: [{ mimetype: "image/png", buffer: Buffer.from([1, 2, 3, 4]), size: 4 }],
  });

  assert.equal(result.media[0].deduplicated, true);
  assert.equal(result.media[0].mediaId, "dedup-media");
  assert.equal(result.media[0].url, "/api/media/files/dedup-media");
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
    ObjectId: function ObjectId(value) { this.value = value; this.toString = () => String(value); },
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
      findMediaById: async () => ({
        _id: "media-1",
        storagePath: "file.png",
        createdBy: { toString: () => "65f000000000000000000001" },
      }),
      findMediaReferences: async () => ({ reviewRef: { _id: "rev-1" }, ticketRef: null, contentRef: null }),
      deleteMediaById: async () => {
        throw new Error("should not delete");
      },
    },
    MEDIA_ENABLE_PROCESSING: false,
    MEDIA_UPLOAD_DIR: "/tmp/uploads",
    maybeCompressImage: async (buffer) => buffer,
    ObjectId: function ObjectId(value) { this.value = value; this.toString = () => String(value); },
  });

  const result = await service.deleteMediaById({
    auth: { sub: "65f000000000000000000001", roles: ["customer"] },
    mediaId: "media-1",
  });
  assert.equal(result.status, 409);
  assert.equal(result.body.code, "MEDIA_IN_USE");
});

test("deleteMediaById hides media from non-owner users", async () => {
  const service = createMediaService({
    ALLOWED_MEDIA_MIME: {},
    createError,
    detectMimeFromMagicBytes: () => null,
    fs: { mkdir: async () => {}, writeFile: async () => {}, rm: async () => {} },
    MAX_UPLOAD_BYTES: 10,
    mediaRepository: {
      findMediaById: async () => ({ _id: "media-1", createdBy: { toString: () => "65f000000000000000000001" } }),
      findMediaReferences: async () => ({ reviewRef: null, ticketRef: null, contentRef: null }),
      deleteMediaById: async () => {
        throw new Error("should not delete");
      },
    },
    MEDIA_ENABLE_PROCESSING: false,
    MEDIA_UPLOAD_DIR: "/tmp/uploads",
    maybeCompressImage: async (buffer) => buffer,
    ObjectId: function ObjectId(value) { this.value = value; },
  });

  await assert.rejects(
    () =>
      service.deleteMediaById({
        auth: { sub: "65f000000000000000000002", roles: ["customer"] },
        mediaId: "media-1",
      }),
    (error) => error && error.code === "MEDIA_NOT_FOUND" && error.status === 404,
  );
});

test("deleteMediaById decrements refCount for deduplicated media", async () => {
  let decrementArgs = null;
  const service = createMediaService({
    ALLOWED_MEDIA_MIME: {},
    createError,
    detectMimeFromMagicBytes: () => null,
    fs: {
      mkdir: async () => {},
      writeFile: async () => {},
      rm: async () => {
        throw new Error("should not remove file when refCount remains positive");
      },
    },
    MAX_UPLOAD_BYTES: 10,
    mediaRepository: {
      findMediaById: async () => ({
        _id: "media-1",
        createdBy: { toString: () => "65f000000000000000000001" },
        refCount: 3,
        storagePath: "file.png",
      }),
      findMediaReferences: async () => ({ reviewRef: null, ticketRef: null, contentRef: null }),
      decrementMediaRefCount: async (id, ownerId) => {
        decrementArgs = { id, ownerId: ownerId?.toString?.() || null };
        return { _id: id, refCount: 2, ownerRefs: { "65f000000000000000000001": 1 } };
      },
      cleanupMediaOwnerRef: async () => {
        throw new Error("should not clean up owner when refs remain");
      },
      deleteMediaById: async () => {
        throw new Error("should not hard delete while shared");
      },
    },
    MEDIA_ENABLE_PROCESSING: false,
    MEDIA_UPLOAD_DIR: "/tmp/uploads",
    maybeCompressImage: async (buffer) => buffer,
    ObjectId: function ObjectId(value) { this.value = value; this.toString = () => String(value); },
  });

  const result = await service.deleteMediaById({
    auth: { sub: "65f000000000000000000001", roles: ["customer"] },
    mediaId: "media-1",
  });

  assert.equal(result.status, 200);
  assert.deepEqual(decrementArgs, { id: "media-1", ownerId: "65f000000000000000000001" });
});

test("deleteMediaById prevents repeated decrements by same owner on shared media", async () => {
  let state = {
    _id: "media-1",
    createdBy: { toString: () => "65f000000000000000000002" },
    ownerIds: [{ toString: () => "65f000000000000000000001" }, { toString: () => "65f000000000000000000002" }],
    ownerRefs: { "65f000000000000000000001": 1, "65f000000000000000000002": 1 },
    refCount: 2,
    storagePath: "file.png",
  };

  const service = createMediaService({
    ALLOWED_MEDIA_MIME: {},
    createError,
    detectMimeFromMagicBytes: () => null,
    fs: { mkdir: async () => {}, writeFile: async () => {}, rm: async () => {} },
    MAX_UPLOAD_BYTES: 10,
    mediaRepository: {
      findMediaById: async () => state,
      findMediaReferences: async () => ({ reviewRef: null, ticketRef: null, contentRef: null }),
      decrementMediaRefCount: async (_id, ownerId) => {
        const ownerKey = ownerId?.toString?.();
        if (!ownerKey || (state.ownerRefs[ownerKey] || 0) <= 0) {
          return null;
        }
        state = {
          ...state,
          refCount: state.refCount - 1,
          ownerRefs: {
            ...state.ownerRefs,
            [ownerKey]: state.ownerRefs[ownerKey] - 1,
          },
        };
        return state;
      },
      cleanupMediaOwnerRef: async (_id, ownerId) => {
        const ownerKey = ownerId.toString();
        state = {
          ...state,
          ownerIds: state.ownerIds.filter((entry) => entry.toString() !== ownerKey),
          ownerRefs: Object.fromEntries(Object.entries(state.ownerRefs).filter(([key]) => key !== ownerKey)),
        };
      },
      deleteMediaById: async () => {
        throw new Error("should not hard delete while shared");
      },
    },
    MEDIA_ENABLE_PROCESSING: false,
    MEDIA_UPLOAD_DIR: "/tmp/uploads",
    maybeCompressImage: async (buffer) => buffer,
    ObjectId: function ObjectId(value) { this.value = value; this.toString = () => String(value); },
  });

  const firstDelete = await service.deleteMediaById({
    auth: { sub: "65f000000000000000000001", roles: ["customer"] },
    mediaId: "media-1",
  });
  assert.equal(firstDelete.status, 200);

  await assert.rejects(
    () =>
      service.deleteMediaById({
        auth: { sub: "65f000000000000000000001", roles: ["customer"] },
        mediaId: "media-1",
      }),
    (error) => error && error.code === "MEDIA_NOT_FOUND" && error.status === 404,
  );
});

test("getMediaFileById returns file path for owner and hides for non-owner", async () => {
  const service = createMediaService({
    ALLOWED_MEDIA_MIME: {},
    createError,
    detectMimeFromMagicBytes: () => null,
    fs: { mkdir: async () => {}, writeFile: async () => {}, rm: async () => {} },
    MAX_UPLOAD_BYTES: 10,
    mediaRepository: {
      findMediaById: async () => ({
        _id: "media-1",
        createdBy: { toString: () => "65f000000000000000000001" },
        storagePath: "hash.png",
        mime: "image/png",
      }),
    },
    MEDIA_ENABLE_PROCESSING: false,
    MEDIA_UPLOAD_DIR: "/tmp/uploads",
    maybeCompressImage: async (buffer) => buffer,
    ObjectId: function ObjectId(value) { this.value = value; this.toString = () => String(value); },
  });

  const allowed = await service.getMediaFileById({
    auth: { sub: "65f000000000000000000001", roles: ["customer"] },
    mediaId: "media-1",
  });
  assert.equal(allowed.mime, "image/png");
  assert.ok(allowed.filePath.endsWith("/tmp/uploads/hash.png"));

  await assert.rejects(
    () =>
      service.getMediaFileById({
        auth: { sub: "65f000000000000000000002", roles: ["customer"] },
        mediaId: "media-1",
      }),
    (error) => error && error.code === "MEDIA_NOT_FOUND" && error.status === 404,
  );
});
