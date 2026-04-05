const { runRetentionCleanup } = require("../scripts/retentionCleanup");

const DAY_MS = 24 * 60 * 60 * 1000;

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

function startRetentionCleanupScheduler({
  env = process.env,
  logger = console,
  runCleanup = runRetentionCleanup,
  setIntervalFn = setInterval,
} = {}) {
  const enabled = toBoolean(env.RETENTION_CLEANUP_SCHEDULER_ENABLED, true);
  if (!enabled) {
    return null;
  }

  const intervalMs = toPositiveInt(env.RETENTION_CLEANUP_INTERVAL_MS, DAY_MS);

  const tick = async () => {
    try {
      await runCleanup({ env, logger });
    } catch (error) {
      logger.error(`retention cleanup scheduler failed: ${error.message}`);
    }
  };

  const timer = setIntervalFn(() => {
    tick();
  }, intervalMs);

  tick();
  logger.log(`retention cleanup scheduler enabled: every ${intervalMs}ms`);
  return timer;
}

module.exports = {
  DAY_MS,
  startRetentionCleanupScheduler,
};
