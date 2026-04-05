const test = require("node:test");
const assert = require("node:assert/strict");

const {
  DEFAULT_BATCH_SIZE,
  DEFAULT_INTERVAL_MS,
  runScheduledPublishBatch,
  startScheduledContentPublishWorker,
} = require("./contentPublishScheduler");

test("runScheduledPublishBatch promotes due content and syncs search", async () => {
  const promotedIds = [{ toString: () => "content-1" }, { toString: () => "content-2" }];
  const syncedIds = [];

  const promotedCount = await runScheduledPublishBatch({
    contentRepository: {
      publishNextDueScheduledContent: async () => {
        const id = promotedIds.shift();
        return id ? { id } : null;
      },
    },
    syncContentSearchDocument: async (id) => {
      syncedIds.push(id.toString());
    },
    maxItems: DEFAULT_BATCH_SIZE,
  });

  assert.equal(promotedCount, 2);
  assert.deepEqual(syncedIds, ["content-1", "content-2"]);
});

test("scheduler is enabled by default and runs an immediate tick", async () => {
  const logs = [];
  let scheduledInterval = null;
  const runBatchCalls = [];

  startScheduledContentPublishWorker({
    env: {},
    logger: {
      log: (line) => logs.push(line),
      error: () => {},
    },
    contentRepository: {},
    syncContentSearchDocument: async () => {},
    runBatch: async (args) => {
      runBatchCalls.push(args.maxItems);
      return 0;
    },
    setIntervalFn: (fn, interval) => {
      scheduledInterval = interval;
      return { fn, interval };
    },
  });

  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(scheduledInterval, DEFAULT_INTERVAL_MS);
  assert.deepEqual(runBatchCalls, [DEFAULT_BATCH_SIZE]);
  assert.ok(logs.some((line) => line.includes("content publish scheduler enabled")));
});

test("scheduler can be disabled explicitly", () => {
  let called = false;

  const timer = startScheduledContentPublishWorker({
    env: { CONTENT_PUBLISH_SCHEDULER_ENABLED: "false" },
    contentRepository: {},
    syncContentSearchDocument: async () => {},
    setIntervalFn: () => {
      called = true;
      return {};
    },
  });

  assert.equal(timer, null);
  assert.equal(called, false);
});
