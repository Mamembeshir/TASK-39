const test = require("node:test");
const assert = require("node:assert/strict");

const { createSearchSyncService } = require("../../../../src/services/search/searchSyncService");

function createFakeDatabase({ service = null, content = null } = {}) {
  const calls = [];
  return {
    calls,
    collection(name) {
      return {
        async findOne() {
          if (name === "services") {
            return service;
          }
          if (name === "content_versions") {
            return content;
          }
          return null;
        },
        async deleteOne(filter) {
          calls.push({ name, op: "deleteOne", filter });
        },
        async updateOne(filter, update, options) {
          calls.push({ name, op: "updateOne", filter, update, options });
        },
      };
    },
  };
}

test("syncServiceSearchDocument deletes unpublished services", async () => {
  const database = createFakeDatabase({ service: { _id: "svc-1", published: false } });
  const service = createSearchSyncService({ getDatabase: () => database });

  await service.syncServiceSearchDocument("svc-1");

  assert.deepEqual(database.calls, [
    { name: "search_documents", op: "deleteOne", filter: { type: "service", sourceId: "svc-1" } },
  ]);
});

test("syncServiceSearchDocument upserts published services", async () => {
  const database = createFakeDatabase({
    service: { _id: "svc-1", published: true, title: "Service", description: "Desc", tags: ["a"], updatedAt: new Date("2026-01-01T00:00:00.000Z") },
  });
  const service = createSearchSyncService({ getDatabase: () => database });

  await service.syncServiceSearchDocument("svc-1");

  assert.equal(database.calls[0].name, "search_documents");
  assert.equal(database.calls[0].op, "updateOne");
  assert.deepEqual(database.calls[0].filter, { type: "service", sourceId: "svc-1" });
  assert.equal(database.calls[0].update.$set.title, "Service");
  assert.equal(database.calls[0].update.$set.searchText, "Service Desc a");
  assert.deepEqual(database.calls[0].options, { upsert: true });
});

test("syncContentSearchDocument deletes missing published versions", async () => {
  const database = createFakeDatabase({
    content: { _id: "content-1", status: "published", publishedVersionId: { toString: () => "v2" }, versions: [{ id: { toString: () => "v1" } }] },
  });
  const service = createSearchSyncService({ getDatabase: () => database });

  await service.syncContentSearchDocument("content-1");

  assert.deepEqual(database.calls, [
    { name: "search_documents", op: "deleteOne", filter: { type: "content", sourceId: "content-1" } },
  ]);
});

test("syncContentSearchDocument upserts published content", async () => {
  const database = createFakeDatabase({
    content: {
      _id: "content-1",
      slug: "slug",
      status: "published",
      publishedAt: new Date("2026-01-02T00:00:00.000Z"),
      publishedVersionId: { toString: () => "v1" },
      versions: [{ id: { toString: () => "v1" }, title: "Article", body: "Body" }],
    },
  });
  const service = createSearchSyncService({ getDatabase: () => database });

  await service.syncContentSearchDocument("content-1");

  assert.equal(database.calls[0].op, "updateOne");
  assert.deepEqual(database.calls[0].filter, { type: "content", sourceId: "content-1" });
  assert.equal(database.calls[0].update.$set.searchText, "slug Article Body");
  assert.deepEqual(database.calls[0].options, { upsert: true });
});
