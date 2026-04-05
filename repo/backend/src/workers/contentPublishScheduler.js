const DEFAULT_INTERVAL_MS = 15 * 1000;
const DEFAULT_BATCH_SIZE = 25;

function toBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }
  return String(value).toLowerCase() === "true";
}

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

async function runScheduledPublishBatch({
  contentRepository,
  syncContentSearchDocument,
  maxItems = DEFAULT_BATCH_SIZE,
} = {}) {
  let processed = 0;

  while (processed < maxItems) {
    const published = await contentRepository.publishNextDueScheduledContent(new Date());
    if (!published) {
      break;
    }

    await syncContentSearchDocument(published.id);
    processed += 1;
  }

  return processed;
}

function startScheduledContentPublishWorker({
  env = process.env,
  logger = console,
  contentRepository,
  syncContentSearchDocument,
  runBatch = runScheduledPublishBatch,
  setIntervalFn = setInterval,
} = {}) {
  const enabled = toBoolean(env.CONTENT_PUBLISH_SCHEDULER_ENABLED, true);
  if (!enabled) {
    return null;
  }

  const intervalMs = toPositiveInt(env.CONTENT_PUBLISH_SCHEDULER_INTERVAL_MS, DEFAULT_INTERVAL_MS);
  const batchSize = toPositiveInt(env.CONTENT_PUBLISH_SCHEDULER_BATCH_SIZE, DEFAULT_BATCH_SIZE);

  const tick = async () => {
    try {
      const processed = await runBatch({
        contentRepository,
        syncContentSearchDocument,
        maxItems: batchSize,
      });

      if (processed > 0) {
        logger.log(`content publish scheduler promoted ${processed} scheduled item(s)`);
      }
    } catch (error) {
      logger.error(`content publish scheduler failed: ${error.message}`);
    }
  };

  const timer = setIntervalFn(() => {
    tick();
  }, intervalMs);

  tick();
  logger.log(`content publish scheduler enabled: every ${intervalMs}ms`);
  return timer;
}

module.exports = {
  DEFAULT_BATCH_SIZE,
  DEFAULT_INTERVAL_MS,
  runScheduledPublishBatch,
  startScheduledContentPublishWorker,
};
