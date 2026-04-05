const { MongoClient } = require("mongodb");
const { seedDatabase } = require("../dbSeedFixtures");

const DEFAULT_URI = "mongodb://mongodb:27017/homecareops";
const DEFAULT_DB_NAME = "homecareops";

function parseDatabaseName(uri) {
  try {
    const url = new URL(uri);
    const path = url.pathname.replace(/^\//, "");
    return path || DEFAULT_DB_NAME;
  } catch (error) {
    return DEFAULT_DB_NAME;
  }
}

async function main() {
  const nodeEnv = process.env.NODE_ENV || "development";
  if (nodeEnv === "production") {
    throw new Error("Fixture seeding script is not allowed in production");
  }

  const uri = process.env.MONGO_URI || DEFAULT_URI;
  const dbName = parseDatabaseName(uri);
  const client = new MongoClient(uri);

  await client.connect();
  try {
    const db = client.db(dbName);
    await seedDatabase(db);
    console.log("Fixture seeding completed");
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(`Fixture seeding failed: ${error.message}`);
  process.exit(1);
});
