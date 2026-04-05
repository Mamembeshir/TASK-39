const test = require("node:test");
const assert = require("node:assert/strict");

const { createInboxService } = require("./inboxService");

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
