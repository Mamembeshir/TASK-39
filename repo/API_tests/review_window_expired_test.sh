#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"

login_code=$(curl -sS -o /tmp/review_window_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: review-window-device" \
  -d '{"username":"customer_demo","password":"devpass123456"}')

fixture_code=$(curl -sS -o /tmp/review_window_fixture.json -w "%{http_code}" -X POST "$base_url/api/internal/test-fixtures/completed-order")

if [ "$login_code" != "200" ] || [ "$fixture_code" != "201" ]; then
  exit 1
fi

token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.accessToken);' /tmp/review_window_login.json)
order_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.orderId);' /tmp/review_window_fixture.json)

ORDER_ID="$order_id" node - <<'EOF'
const { MongoClient, ObjectId } = require('./backend/node_modules/mongodb');

const uri = process.env.MONGO_URI || process.env.TEST_MONGO_URI || 'mongodb://mongodb:27017/homecareops_test';
const client = new MongoClient(uri);

async function main() {
  const orderId = process.env.ORDER_ID;
  const staleCompletedAt = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);

  await client.connect();
  const dbName = new URL(uri).pathname.replace(/^\//, '') || 'homecareops_test';
  const db = client.db(dbName);
  const result = await db.collection('orders').updateOne(
    { _id: new ObjectId(orderId) },
    { $set: { completedAt: staleCompletedAt, updatedAt: new Date() } },
  );

  if (result.modifiedCount !== 1) {
    throw new Error(`Expected one order update, modified ${result.modifiedCount}`);
  }
}

main().finally(async () => {
  await client.close();
});
EOF

if [ $? -ne 0 ]; then
  exit 1
fi

create_code=$(curl -sS -o /tmp/review_window_create.json -w "%{http_code}" -X POST "$base_url/api/reviews" \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d "{\"orderId\":\"$order_id\",\"rating\":5,\"tags\":[\"quality\",\"communication\"],\"text\":\"window check\",\"mediaIds\":[]}")

if [ "$create_code" != "400" ]; then
  exit 1
fi

node -e '
const fs=require("fs");
const payload=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
process.exit(payload && payload.code === "REVIEW_WINDOW_EXPIRED" ? 0 : 1);
' /tmp/review_window_create.json
