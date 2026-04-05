const test = require("node:test");
const assert = require("node:assert/strict");

const { createContentService } = require("./contentService");

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
