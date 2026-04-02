const { MongoClient } = require("mongodb");

const DEFAULT_TEST_URI = "mongodb://mongodb:27017/homecareops_test";
const TRANSIENT_COLLECTIONS = [
  "auth_rate_limits",
  "login_attempts",
  "refresh_tokens",
  "user_devices",
  "blacklists",
];

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
    throw new Error(`Refusing to reset non-test database: ${dbName}`);
  }

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbName);
    await Promise.all(TRANSIENT_COLLECTIONS.map((name) => db.collection(name).deleteMany({})));
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
