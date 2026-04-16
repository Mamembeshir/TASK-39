const test = require("node:test");
const assert = require("node:assert/strict");

const { createContentService } = require("../../../../src/services/content/contentService");

function createError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

test("updateContentDraftById writes content.draft.update audit action", async () => {
  const auditLogs = [];
  const service = createContentService({
    buildContentVersion: () => ({ id: { toString: () => "ver-1" }, body: "draft body", mediaIds: [] }),
    contentRepository: {
      pushDraftVersion: async () => true,
    },
    createError,
    extractContentMediaRefs: () => [],
    mediaRepository: {
      findMediaByIds: async () => [],
    },
    ObjectId: function MockObjectId(value) {
      return { toString: () => String(value) };
    },
    parseObjectIdArray: () => ({ ok: true, parsed: [] }),
    parseObjectIdOrNull: (value) => ({ toString: () => String(value) }),
    syncContentSearchDocument: async () => {},
    writeAuditLog: async (entry) => {
      auditLogs.push(entry);
    },
  });

  const result = await service.updateContentDraftById({
    auth: { username: "admin_demo", sub: "65f000000000000000000002" },
    body: { title: "Updated", body: "draft body", mediaIds: [] },
    contentId: { toString: () => "content-1" },
    req: { method: "PATCH", originalUrl: "/api/content/content-1/draft", headers: {} },
  });

  assert.equal(result.id, "content-1");
  assert.equal(auditLogs.length, 1);
  assert.equal(auditLogs[0].action, "content.draft.update");
});

test("scheduleContentById writes content.schedule audit action", async () => {
  const auditLogs = [];
  const versionId = { toString: () => "ver-1" };
  const service = createContentService({
    buildContentVersion: () => ({ id: versionId }),
    contentRepository: {
      findContentById: async () => ({
        _id: { toString: () => "content-1" },
        currentVersionId: versionId,
        versions: [{ id: versionId }],
      }),
      updateSchedule: async () => {},
    },
    createError,
    extractContentMediaRefs: () => [],
    mediaRepository: {
      findMediaByIds: async () => [],
    },
    ObjectId: function MockObjectId(value) {
      return { toString: () => String(value) };
    },
    parseObjectIdArray: () => ({ ok: true, parsed: [] }),
    parseObjectIdOrNull: () => versionId,
    syncContentSearchDocument: async () => {},
    writeAuditLog: async (entry) => {
      auditLogs.push(entry);
    },
  });

  const result = await service.scheduleContentById({
    auth: { username: "admin_demo", sub: "65f000000000000000000002" },
    body: { publishAt: "2030-01-01T12:00:00.000Z" },
    contentId: { toString: () => "content-1" },
    req: { method: "POST", originalUrl: "/api/content/content-1/schedule", headers: {} },
  });

  assert.equal(result.id, "content-1");
  assert.equal(auditLogs.length, 1);
  assert.equal(auditLogs[0].action, "content.schedule");
});

test("publishContentById writes content.publish audit action", async () => {
  const auditLogs = [];
  const versionId = { toString: () => "ver-1" };
  const contentId = { toString: () => "content-1" };
  const service = createContentService({
    buildContentVersion: () => ({ id: versionId }),
    contentRepository: {
      findContentById: async () => ({
        _id: contentId,
        currentVersionId: versionId,
        versions: [{ id: versionId, body: "published body", mediaIds: [] }],
      }),
      publishVersion: async () => {},
    },
    createError,
    extractContentMediaRefs: () => [],
    mediaRepository: {
      findMediaByIds: async () => [],
    },
    ObjectId: function MockObjectId(value) {
      return { toString: () => String(value) };
    },
    parseObjectIdArray: () => ({ ok: true, parsed: [] }),
    parseObjectIdOrNull: () => versionId,
    syncContentSearchDocument: async () => {},
    writeAuditLog: async (entry) => {
      auditLogs.push(entry);
    },
  });

  const result = await service.publishContentById({
    auth: { username: "admin_demo", sub: "65f000000000000000000002" },
    body: {},
    contentId,
    req: { method: "POST", originalUrl: "/api/content/content-1/publish", headers: {} },
  });

  assert.equal(result.id, "content-1");
  assert.equal(auditLogs.length, 1);
  assert.equal(auditLogs[0].action, "content.publish");
});

test("rollbackContentById writes content.rollback audit action", async () => {
  const auditLogs = [];
  const rollbackVersionId = { toString: () => "ver-2" };
  const contentId = { toString: () => "content-1" };
  const service = createContentService({
    buildContentVersion: () => ({ id: rollbackVersionId }),
    contentRepository: {
      findContentById: async () => ({
        _id: contentId,
        currentVersionId: rollbackVersionId,
        versions: [{ id: rollbackVersionId, body: "rollback body", mediaIds: [] }],
      }),
      rollbackVersion: async () => {},
    },
    createError,
    extractContentMediaRefs: () => [],
    mediaRepository: {
      findMediaByIds: async () => [],
    },
    ObjectId: function MockObjectId(value) {
      return { toString: () => String(value) };
    },
    parseObjectIdArray: () => ({ ok: true, parsed: [] }),
    parseObjectIdOrNull: () => rollbackVersionId,
    syncContentSearchDocument: async () => {},
    writeAuditLog: async (entry) => {
      auditLogs.push(entry);
    },
  });

  const result = await service.rollbackContentById({
    auth: { username: "admin_demo", sub: "65f000000000000000000002" },
    body: { versionId: "ver-2" },
    contentId,
    req: { method: "POST", originalUrl: "/api/content/content-1/rollback", headers: {} },
  });

  assert.equal(result.id, "content-1");
  assert.equal(auditLogs.length, 1);
  assert.equal(auditLogs[0].action, "content.rollback");
});

// ---------- Additional coverage tests ----------

function makeBaseDeps(overrides = {}) {
  return {
    buildContentVersion: ({ title, body, mediaIds } = {}) => ({
      id: { toString: () => "ver-new" },
      title: title || "T",
      body: body || "",
      mediaIds: mediaIds || [],
      createdAt: new Date("2024-01-01T00:00:00Z"),
    }),
    contentRepository: {},
    createError,
    extractContentMediaRefs: () => [],
    mediaRepository: { findMediaByIds: async () => [] },
    ObjectId: function (v) { return { toString: () => String(v) }; },
    parseObjectIdArray: () => ({ ok: true, parsed: [] }),
    parseObjectIdOrNull: (v) => (v ? { toString: () => String(v) } : null),
    syncContentSearchDocument: async () => {},
    writeAuditLog: async () => {},
    ...overrides,
  };
}

test("listPublishedContent maps published content with titles", async () => {
  const verId = { toString: () => "v1" };
  const service = createContentService(makeBaseDeps({
    contentRepository: {
      findPublishedContentSummaries: async () => [
        { _id: { toString: () => "c1" }, slug: "slug-a", publishedVersionId: verId, versions: [{ id: verId, title: "Hello" }], publishedAt: new Date("2024-02-02") },
        { _id: { toString: () => "c2" }, slug: "slug-b", publishedVersionId: null, versions: [] },
      ],
    },
  }));
  const out = await service.listPublishedContent();
  assert.equal(out.length, 2);
  assert.equal(out[0].title, "Hello");
  assert.equal(out[1].title, "slug-b");
});

test("listAllContent includes status, currentVersionId, publishedVersionId", async () => {
  const v1 = { toString: () => "v1" };
  const v2 = { toString: () => "v2" };
  const service = createContentService(makeBaseDeps({
    contentRepository: {
      findAllContentSummaries: async () => [
        {
          _id: { toString: () => "c1" },
          slug: "a",
          status: "draft",
          currentVersionId: v2,
          publishedVersionId: v1,
          versions: [{ id: v1, title: "Pub" }, { id: v2, title: "Cur" }],
          publishedAt: null,
          scheduledPublishAt: null,
        },
      ],
    },
  }));
  const out = await service.listAllContent();
  assert.equal(out[0].title, "Cur");
  assert.equal(out[0].currentVersionId, "v2");
  assert.equal(out[0].publishedVersionId, "v1");
  assert.equal(out[0].status, "draft");
});

test("getPublicContentById returns public payload when published", async () => {
  const verId = { toString: () => "v1" };
  const service = createContentService(makeBaseDeps({
    contentRepository: {
      findPublishedContentById: async () => ({
        _id: { toString: () => "c1" },
        slug: "slug-a",
        publishedVersionId: verId,
        versions: [{ id: verId, title: "T", body: "B" }],
        publishedAt: new Date("2024-02-02"),
      }),
    },
  }));
  const out = await service.getPublicContentById({ auth: null, contentId: "c1" });
  assert.equal(out.title, "T");
  assert.equal(out.body, "B");
});

test("getPublicContentById falls back to staff view for admins on unpublished content", async () => {
  const verId = { toString: () => "v1" };
  const service = createContentService(makeBaseDeps({
    contentRepository: {
      findPublishedContentById: async () => null,
      findContentById: async () => ({
        _id: { toString: () => "c1" },
        slug: "slug-a",
        status: "draft",
        publishedVersionId: verId,
        currentVersionId: verId,
        versions: [{ id: verId, title: "T", body: "B", mediaIds: [], createdAt: new Date() }],
      }),
    },
  }));
  const out = await service.getPublicContentById({ auth: { roles: ["administrator"] }, contentId: "c1" });
  assert.equal(out.status, "draft");
  assert.equal(out.versions.length, 1);
});

test("getPublicContentById throws 404 when not found for public user", async () => {
  const service = createContentService(makeBaseDeps({
    contentRepository: { findPublishedContentById: async () => null },
  }));
  await assert.rejects(
    () => service.getPublicContentById({ auth: null, contentId: "c1" }),
    (e) => e.code === "CONTENT_NOT_FOUND",
  );
});

test("getPublicContentById throws 404 for admin when content truly missing", async () => {
  const service = createContentService(makeBaseDeps({
    contentRepository: {
      findPublishedContentById: async () => null,
      findContentById: async () => null,
    },
  }));
  await assert.rejects(
    () => service.getPublicContentById({ auth: { roles: ["administrator"] }, contentId: "c1" }),
    (e) => e.code === "CONTENT_NOT_FOUND",
  );
});

test("createContent throws 400 when slug missing", async () => {
  const service = createContentService(makeBaseDeps());
  await assert.rejects(
    () => service.createContent({ body: {} }),
    (e) => e.code === "INVALID_SLUG",
  );
});

test("createContent throws 400 when mediaIds not parseable", async () => {
  const service = createContentService(makeBaseDeps({
    parseObjectIdArray: () => ({ ok: false }),
  }));
  await assert.rejects(
    () => service.createContent({ body: { slug: "a", mediaIds: ["bad"] } }),
    (e) => e.code === "INVALID_MEDIA_ID",
  );
});

test("createContent inserts and returns ids on success", async () => {
  const service = createContentService(makeBaseDeps({
    contentRepository: {
      insertContent: async () => ({ insertedId: { toString: () => "c1" } }),
    },
  }));
  const out = await service.createContent({ body: { slug: "a", title: "T", body: "B" } });
  assert.equal(out.id, "c1");
  assert.equal(out.versionId, "ver-new");
});

test("createContent translates duplicate key error to SLUG_EXISTS", async () => {
  const service = createContentService(makeBaseDeps({
    contentRepository: {
      insertContent: async () => {
        const err = new Error("dup"); err.code = 11000; throw err;
      },
    },
  }));
  await assert.rejects(
    () => service.createContent({ body: { slug: "a" } }),
    (e) => e.code === "SLUG_EXISTS",
  );
});

test("updateContentDraftById throws 404 when pushDraftVersion returns falsy", async () => {
  const service = createContentService(makeBaseDeps({
    contentRepository: { pushDraftVersion: async () => null },
  }));
  await assert.rejects(
    () => service.updateContentDraftById({ auth: {}, body: {}, contentId: { toString: () => "c1" }, req: {} }),
    (e) => e.code === "CONTENT_NOT_FOUND",
  );
});

test("scheduleContentById rejects invalid publishAt", async () => {
  const service = createContentService(makeBaseDeps());
  await assert.rejects(
    () => service.scheduleContentById({ auth: {}, body: { publishAt: "nope" }, contentId: "c1", req: {} }),
    (e) => e.code === "INVALID_PUBLISH_AT",
  );
});

test("scheduleContentById rejects when versionId not in content", async () => {
  const service = createContentService(makeBaseDeps({
    contentRepository: {
      findContentById: async () => ({ currentVersionId: null, versions: [] }),
    },
    parseObjectIdOrNull: () => ({ toString: () => "missing" }),
  }));
  await assert.rejects(
    () => service.scheduleContentById({
      auth: {}, body: { publishAt: "2030-01-01T00:00:00Z", versionId: "missing" },
      contentId: "c1", req: {},
    }),
    (e) => e.code === "VERSION_NOT_FOUND",
  );
});

test("publishContentById throws INVALID_VERSION_ID when no version available", async () => {
  const service = createContentService(makeBaseDeps({
    contentRepository: {
      findContentById: async () => ({ currentVersionId: null, versions: [] }),
    },
    parseObjectIdOrNull: () => null,
  }));
  await assert.rejects(
    () => service.publishContentById({ auth: {}, body: {}, contentId: "c1", req: {} }),
    (e) => e.code === "INVALID_VERSION_ID",
  );
});

test("getContentVersionsById returns version list", async () => {
  const v1 = { toString: () => "v1" };
  const service = createContentService(makeBaseDeps({
    contentRepository: {
      findContentById: async () => ({
        slug: "a", status: "draft",
        currentVersionId: v1, publishedVersionId: null,
        scheduledPublishAt: null, scheduledVersionId: null,
        versions: [{ id: v1, title: "T", body: "B", mediaIds: [], createdAt: new Date() }],
      }),
    },
  }));
  const out = await service.getContentVersionsById({ contentId: { toString: () => "c1" } });
  assert.equal(out.versions.length, 1);
  assert.equal(out.currentVersionId, "v1");
});

test("rollbackContentById rejects invalid versionId", async () => {
  const service = createContentService(makeBaseDeps({
    parseObjectIdOrNull: () => null,
  }));
  await assert.rejects(
    () => service.rollbackContentById({ auth: {}, body: { versionId: "bad" }, contentId: "c1", req: {} }),
    (e) => e.code === "INVALID_VERSION_ID",
  );
});

test("parseContentIdOrThrow throws 400 on invalid id", async () => {
  const service = createContentService(makeBaseDeps({
    parseObjectIdOrNull: () => null,
  }));
  assert.throws(
    () => service.parseContentIdOrThrow("bad"),
    (e) => e.code === "INVALID_CONTENT_ID",
  );
});

test("parseContentIdOrThrow returns parsed id on valid input", async () => {
  const service = createContentService(makeBaseDeps({
    parseObjectIdOrNull: (v) => ({ toString: () => String(v) }),
  }));
  const id = service.parseContentIdOrThrow("abc");
  assert.equal(id.toString(), "abc");
});

test("validateAndCollectMediaRefs (via createContent) rejects invalid media id", async () => {
  const service = createContentService(makeBaseDeps({
    extractContentMediaRefs: () => ["bad-id"],
    parseObjectIdOrNull: (v) => (v === "bad-id" ? null : { toString: () => String(v) }),
  }));
  await assert.rejects(
    () => service.createContent({ body: { slug: "a", body: "<img/>" } }),
    (e) => e.code === "INVALID_MEDIA_ID",
  );
});

test("validateAndCollectMediaRefs (via createContent) rejects when media missing", async () => {
  const service = createContentService(makeBaseDeps({
    extractContentMediaRefs: () => ["m1"],
    parseObjectIdOrNull: (v) => ({ toString: () => String(v) }),
    mediaRepository: { findMediaByIds: async () => [] },
  }));
  await assert.rejects(
    () => service.createContent({ body: { slug: "a", body: "<img/>" } }),
    (e) => e.code === "MEDIA_NOT_FOUND",
  );
});

test("validateAndCollectMediaRefs rejects media with wrong purpose", async () => {
  const service = createContentService(makeBaseDeps({
    extractContentMediaRefs: () => ["m1"],
    parseObjectIdOrNull: (v) => ({ toString: () => String(v) }),
    mediaRepository: { findMediaByIds: async () => [{ _id: "m1", purpose: "hero" }] },
  }));
  await assert.rejects(
    () => service.createContent({ body: { slug: "a", body: "<img/>" } }),
    (e) => e.code === "INVALID_MEDIA_PURPOSE",
  );
});
