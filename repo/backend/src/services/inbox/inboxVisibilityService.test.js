const test = require("node:test");
const assert = require("node:assert/strict");

const { buildInboxVisibilityFilter } = require("./inboxVisibilityService");

test("buildInboxVisibilityFilter includes publishAt cutoff and visibility clauses", () => {
  const now = new Date("2026-03-31T12:00:00.000Z");
  const filter = buildInboxVisibilityFilter("user-1", ["moderator", "administrator"], now);

  assert.deepEqual(filter, {
    publishAt: { $lte: now },
    $or: [
      { recipientUserId: "user-1" },
      {
        recipientUserId: null,
        $or: [
          { roles: { $exists: false } },
          { roles: { $size: 0 } },
          { roles: { $in: ["moderator", "administrator"] } },
          { roleTargets: { $in: ["moderator", "administrator"] } },
        ],
      },
    ],
  });
});
