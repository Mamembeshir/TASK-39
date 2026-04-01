const { MongoClient } = require("mongodb");

const DEFAULT_TEST_URI = "mongodb://mongodb:27017/homecareops_test";

function parseDatabaseName(uri) {
  try {
    const url = new URL(uri);
    return url.pathname.replace(/^\//, "") || "homecareops_test";
  } catch {
    return "homecareops_test";
  }
}

async function main() {
  const uri = process.argv[2] || process.env.MONGO_URI || process.env.TEST_MONGO_URI || DEFAULT_TEST_URI;
  const dbName = parseDatabaseName(uri);

  if (!dbName.endsWith("_test")) {
    throw new Error(`Refusing to drop non-test database: ${dbName}`);
  }

  const client = new MongoClient(uri);
  try {
    await client.connect();
    await client.db(dbName).dropDatabase();
    console.log(`Dropped test database: ${dbName}`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
