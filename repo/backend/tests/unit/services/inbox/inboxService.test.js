const test = require("node:test");
const assert = require("node:assert/strict");

const { createInboxService } = require("../../../../src/services/inbox/inboxService");

function createError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

test("createStaffMessage validates roles and trims content", async () => {
  let inserted = null;
  const service = createInboxService({
    buildInboxVisibilityFilter: () => ({}),
    createError,
    messagesRepository: {
      insertMessage: async (doc) => {
        inserted = doc;
        return { insertedId: { toString: () => 'msg-1' } };
      },
    },
  });

  const result = await service.createStaffMessage({
    auth: { sub: '65f000000000000000000002' },
    payload: { title: '  Hello ', body: ' Body ', roles: ['customer'] },
    ObjectId: function ObjectId(value) { this.value = value; },
    parseObjectIdOrNull: (value) => value,
  });

  assert.deepEqual(result, { id: 'msg-1' });
  assert.equal(inserted.title, 'Hello');
  assert.equal(inserted.body, 'Body');
  assert.deepEqual(inserted.roles, ['customer']);
});

test("markInboxRead throws when message is not visible", async () => {
  const service = createInboxService({
    buildInboxVisibilityFilter: () => ({ visible: true }),
    createError,
    messagesRepository: {
      markMessageRead: async () => null,
    },
  });

  await assert.rejects(
    () => service.markInboxRead({
      auth: { sub: 'u1', roles: ['customer'] },
      messageId: 'm1',
      ObjectId: function ObjectId(value) { this.value = value; },
    }),
    (error) => error && error.code === 'MESSAGE_NOT_FOUND',
  );
});

test("build visibility keeps targeted messages scoped to recipient", async () => {
  let capturedFilter = null;
  const service = createInboxService({
    buildInboxVisibilityFilter: (userId, roles, now) => {
      capturedFilter = {
        publishAt: { $lte: now },
        $or: [
          { recipientUserId: userId },
          {
            recipientUserId: null,
            $or: [
              { roles: { $exists: false } },
              { roles: { $size: 0 } },
              { roles: { $in: roles } },
            ],
          },
        ],
      };
      return capturedFilter;
    },
    createError,
    messagesRepository: {
      listMessages: async () => [],
    },
  });

  await service.listInbox({
    auth: { sub: 'u1', roles: ['customer'] },
    ObjectId: function ObjectId(value) { this.value = value; },
  });

  assert.ok(capturedFilter);
  assert.deepEqual(capturedFilter.$or[1].recipientUserId, null);
});

function makeService(overrides = {}) {
  return createInboxService({
    buildInboxVisibilityFilter: () => ({}),
    createError,
    messagesRepository: {
      insertMessage: async () => ({ insertedId: { toString: () => "m" } }),
      listMessages: async () => [],
      markMessageRead: async () => true,
      ...(overrides.messagesRepository || {}),
    },
    ...overrides,
  });
}

const Oid = function ObjectId(v) { this.v = v; this.toString = () => String(v); };

test("createStaffMessage requires title", async () => {
  const svc = makeService();
  await assert.rejects(
    () => svc.createStaffMessage({ auth: { sub: "u" }, payload: { body: "b" }, ObjectId: Oid, parseObjectIdOrNull: (v) => v }),
    (e) => e.code === "INVALID_TITLE",
  );
});

test("createStaffMessage requires body", async () => {
  const svc = makeService();
  await assert.rejects(
    () => svc.createStaffMessage({ auth: { sub: "u" }, payload: { title: "t" }, ObjectId: Oid, parseObjectIdOrNull: (v) => v }),
    (e) => e.code === "INVALID_BODY",
  );
});

test("createStaffMessage rejects unknown role", async () => {
  const svc = makeService();
  await assert.rejects(
    () => svc.createStaffMessage({ auth: { sub: "u" }, payload: { title: "t", body: "b", roles: ["hacker"] }, ObjectId: Oid, parseObjectIdOrNull: (v) => v }),
    (e) => e.code === "INVALID_ROLES",
  );
});

test("createStaffMessage rejects non-array roles", async () => {
  const svc = makeService();
  await assert.rejects(
    () => svc.createStaffMessage({ auth: { sub: "u" }, payload: { title: "t", body: "b", roles: "customer" }, ObjectId: Oid, parseObjectIdOrNull: (v) => v }),
    (e) => e.code === "INVALID_ROLES",
  );
});

test("createStaffMessage rejects invalid publishAt", async () => {
  const svc = makeService();
  await assert.rejects(
    () => svc.createStaffMessage({ auth: { sub: "u" }, payload: { title: "t", body: "b", publishAt: "not-a-date" }, ObjectId: Oid, parseObjectIdOrNull: (v) => v }),
    (e) => e.code === "INVALID_PUBLISH_AT",
  );
});

test("createStaffMessage rejects invalid recipient id", async () => {
  const svc = makeService();
  await assert.rejects(
    () => svc.createStaffMessage({ auth: { sub: "u" }, payload: { title: "t", body: "b", recipientUserId: "bad" }, ObjectId: Oid, parseObjectIdOrNull: () => null }),
    (e) => e.code === "INVALID_RECIPIENT",
  );
});

test("listInbox maps messages with isRead flag", async () => {
  const svc = makeService({
    messagesRepository: {
      listMessages: async () => [
        { _id: { toString: () => "m1" }, title: "T", body: "B", publishAt: new Date(0), roles: ["customer"], readByUserIds: [{ toString: () => "u1" }] },
        { _id: { toString: () => "m2" }, title: "T2", body: "B2", publishAt: new Date(0), roleTargets: ["admin"] },
      ],
    },
  });
  const out = await svc.listInbox({ auth: { sub: "u1", roles: ["customer"] }, ObjectId: Oid });
  assert.equal(out.messages[0].isRead, true);
  assert.equal(out.messages[1].isRead, false);
  assert.deepEqual(out.messages[1].roles, ["admin"]);
});

test("markInboxRead returns ok on success", async () => {
  const svc = makeService({
    messagesRepository: { markMessageRead: async () => true },
  });
  const out = await svc.markInboxRead({ auth: { sub: "u", roles: ["customer"] }, messageId: "m", ObjectId: Oid });
  assert.deepEqual(out, { status: "ok", isRead: true });
});

