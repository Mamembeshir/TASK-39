const { MongoClient } = require("mongodb");

function parseDatabaseName(connectionUri) {
  try {
    const url = new URL(connectionUri);
    return url.pathname.replace(/^\//, "") || "homecareops";
  } catch (error) {
    return "homecareops";
  }
}

async function isSearchDocumentOrphan(db, doc) {
  if (doc.type === "service") {
    const service = await db.collection("services").findOne({ _id: doc.sourceId, published: true });
    return !service;
  }

  if (doc.type === "content") {
    const content = await db.collection("content_versions").findOne({
      _id: doc.sourceId,
      status: "published",
      publishedVersionId: { $ne: null },
    });
    return !content;
  }

  return true;
}

async function runSearchCleanup({
  connectionUri = process.env.MONGO_URI || "mongodb://mongodb:27017/homecareops",
  mongoClient = MongoClient,
  logger = console,
} = {}) {
  const client = new mongoClient(connectionUri);
  await client.connect();

  try {
    const db = client.db(parseDatabaseName(connectionUri));
    const docs = await db.collection("search_documents").find({}).toArray();

    let removed = 0;
    for (const doc of docs) {
      const orphan = await isSearchDocumentOrphan(db, doc);
      if (!orphan) {
        continue;
      }
      const result = await db.collection("search_documents").deleteOne({ _id: doc._id });
      removed += result.deletedCount;
    }

    logger.log(`search cleanup completed: removed ${removed} orphan documents`);
    return { removed };
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  runSearchCleanup().catch((error) => {
    console.error(`search cleanup failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  parseDatabaseName,
  runSearchCleanup,
};
