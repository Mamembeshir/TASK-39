const test = require("node:test");
const assert = require("node:assert/strict");

const { DAY_MS, startRetentionCleanupScheduler } = require("./retentionCleanupScheduler");

test("retention scheduler is enabled by default and runs immediate tick", async () => {
  const logs = [];
  let scheduledInterval = null;
  const runCalls = [];

  startRetentionCleanupScheduler({
    env: {},
    logger: {
      log: (line) => logs.push(line),
      error: () => {},
    },
    runCleanup: async (args) => {
      runCalls.push(args);
      return { processedTickets: 0, deletedBlobs: 0 };
    },
    setIntervalFn: (_fn, interval) => {
      scheduledInterval = interval;
      return { interval };
    },
  });

  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(scheduledInterval, DAY_MS);
  assert.equal(runCalls.length, 1);
  assert.ok(logs.some((line) => line.includes("retention cleanup scheduler enabled")));
});

test("retention scheduler can be disabled", () => {
  let setCalled = false;

  const timer = startRetentionCleanupScheduler({
    env: { RETENTION_CLEANUP_SCHEDULER_ENABLED: "false" },
    runCleanup: async () => ({ processedTickets: 0, deletedBlobs: 0 }),
    setIntervalFn: () => {
      setCalled = true;
      return {};
    },
  });

  assert.equal(timer, null);
  assert.equal(setCalled, false);
});

test("retention scheduler respects configured interval", () => {
  let scheduledInterval = null;

  startRetentionCleanupScheduler({
    env: { RETENTION_CLEANUP_INTERVAL_MS: "60000" },
    runCleanup: async () => ({ processedTickets: 0, deletedBlobs: 0 }),
    setIntervalFn: (_fn, interval) => {
      scheduledInterval = interval;
      return { interval };
    },
    logger: {
      log: () => {},
      error: () => {},
    },
  });

  assert.equal(scheduledInterval, 60000);
});
