const test = require("node:test");
const assert = require("node:assert/strict");

const { WEEK_MS, startSearchCleanupScheduler } = require("./searchCleanupScheduler");

test("scheduler is enabled by default and uses weekly interval", () => {
  let scheduledInterval = null;
  const logs = [];

  const timer = startSearchCleanupScheduler({
    env: {},
    logger: {
      log: (line) => logs.push(line),
      error: () => {},
    },
    runCleanup: async () => {},
    setIntervalFn: (fn, interval) => {
      scheduledInterval = interval;
      return { fn, interval };
    },
  });

  assert.ok(timer);
  assert.equal(scheduledInterval, WEEK_MS);
  assert.ok(logs.some((line) => line.includes("search cleanup scheduler enabled")));
});

test("scheduler can be disabled explicitly", () => {
  let called = false;
  const timer = startSearchCleanupScheduler({
    env: { SEARCH_CLEANUP_SCHEDULER_ENABLED: "false" },
    runCleanup: async () => {},
    setIntervalFn: () => {
      called = true;
      return {};
    },
  });

  assert.equal(timer, null);
  assert.equal(called, false);
});
