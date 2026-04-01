/*
 * Compatibility data bootstrap module.
 *
 * This module coordinates connection + bootstrap flow while indexes,
 * seed fixtures, and search rebuild steps are isolated in dedicated files.
 */

const { MongoClient } = require("mongodb");
const { ensureIndexes } = require("./dbIndexes");
const { seedDatabase } = require("./dbSeedFixtures");

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

async function rebuildSearchDocuments(database) {
  const now = new Date();
  const docs = [];

  const services = await database.collection("services").find({ published: true }).toArray();
  for (const service of services) {
    docs.push({
      type: "service",
      sourceId: service._id,
      title: service.title,
      body: service.description,
      tags: service.tags || [],
      searchText: [service.title, service.description, ...(service.tags || [])].filter(Boolean).join(" "),
      publishAt: service.updatedAt || now,
      createdAt: now,
      updatedAt: now,
    });
  }

  const contents = await database
    .collection("content_versions")
    .find({
      status: "published",
      publishedVersionId: { $ne: null },
    })
    .toArray();

  for (const content of contents) {
    const published = (content.versions || []).find(
      (version) => version.id && version.id.toString() === content.publishedVersionId.toString(),
    );
    if (!published) {
      continue;
    }

    docs.push({
      type: "content",
      sourceId: content._id,
      title: published.title,
      body: published.body,
      tags: [content.slug],
      searchText: [content.slug, published.title, published.body].filter(Boolean).join(" "),
      publishAt: content.publishedAt || now,
      createdAt: now,
      updatedAt: now,
    });
  }

  await database.collection("search_documents").deleteMany({});
  if (docs.length > 0) {
    await database.collection("search_documents").insertMany(docs);
  }
}

async function initializeDatabase() {
  const uri = process.env.MONGO_URI || DEFAULT_URI;
  const dbName = parseDatabaseName(uri);
  client = new MongoClient(uri);
  await client.connect();
  db = client.db(dbName);
  await ensureIndexes(db);
  await seedDatabase(db);
  await rebuildSearchDocuments(db);
}

async function connectWithRetry() {
  try {
    await initializeDatabase();
    console.log("Connected to MongoDB, indexes ensured, seed data upserted");
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
