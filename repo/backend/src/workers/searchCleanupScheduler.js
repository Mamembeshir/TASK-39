const { runSearchCleanup } = require("../scripts/searchCleanup");

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

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

function startSearchCleanupScheduler({
  env = process.env,
  logger = console,
  runCleanup = runSearchCleanup,
  setIntervalFn = setInterval,
} = {}) {
  const enabled = toBoolean(env.SEARCH_CLEANUP_SCHEDULER_ENABLED, true);
  if (!enabled) {
    return null;
  }

  const intervalMs = toPositiveInt(env.SEARCH_CLEANUP_INTERVAL_MS, WEEK_MS);

  const timer = setIntervalFn(async () => {
    try {
      await runCleanup({ logger });
    } catch (error) {
      logger.error(`search cleanup scheduler failed: ${error.message}`);
    }
  }, intervalMs);

  logger.log(`search cleanup scheduler enabled: every ${intervalMs}ms`);
  return timer;
}

module.exports = {
  WEEK_MS,
  startSearchCleanupScheduler,
};
