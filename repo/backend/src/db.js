/*
 * Compatibility data bootstrap module.
 *
 * This module coordinates connection + bootstrap flow while indexes,
 * seed fixtures, and search rebuild steps are isolated in dedicated files.
 */

const { MongoClient } = require("mongodb");
const { ensureIndexes } = require("./dbIndexes");
const { seedDatabase } = require("./dbSeedFixtures");
const { rebuildSearchDocuments } = require("./dbSearchDocuments");

const DEFAULT_URI = "mongodb://mongodb:27017/homecareops";
const DEFAULT_DB_NAME = "homecareops";
const RETRY_DELAY_MS = 3000;

let client;
let db;

function getDatabase() {
  if (!db) {
    throw new Error("Database not initialized");
  }
  return db;
}

function parseDatabaseName(uri) {
  try {
    const url = new URL(uri);
    const path = url.pathname.replace(/^\//, "");
    return path || DEFAULT_DB_NAME;
  } catch (error) {
    return DEFAULT_DB_NAME;
  }
}

function toBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }
  return String(value).toLowerCase() === "true";
}

async function initializeDatabase() {
  const uri = process.env.MONGO_URI || DEFAULT_URI;
  const nodeEnv = process.env.NODE_ENV || "development";
  const seedFixtures = toBoolean(process.env.SEED_FIXTURES, false);

  if (nodeEnv === "production" && seedFixtures) {
    throw new Error("SEED_FIXTURES=true is not allowed in production");
  }

  const dbName = parseDatabaseName(uri);
  client = new MongoClient(uri);
  await client.connect();
  db = client.db(dbName);
  await ensureIndexes(db);
  if (seedFixtures) {
    await seedDatabase(db);
  }
  await rebuildSearchDocuments(db);
}

async function connectWithRetry() {
  try {
    await initializeDatabase();
    if (toBoolean(process.env.SEED_FIXTURES, false)) {
      console.log("Connected to MongoDB, indexes ensured, seed fixtures upserted");
    } else {
      console.log("Connected to MongoDB, indexes ensured");
    }
  } catch (error) {
    console.error(`MongoDB initialization failed: ${error.message}`);
    await new Promise((resolve) => {
      setTimeout(resolve, RETRY_DELAY_MS);
    });
    return connectWithRetry();
  }
}

module.exports = {
  connectWithRetry,
  getDatabase,
};
