#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"
internal_token="${INTERNAL_ROUTES_TOKEN:-dev-internal-token}"
internal_admin_token="${INTERNAL_ADMIN_TOKEN:-}"

customer_login_code=$(curl -sS -o /tmp/retention_policy_customer_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: retention-policy-customer-device" \
  -d '{"username":"customer_demo","password":"devpass123456"}')

admin_login_code=$(curl -sS -o /tmp/retention_policy_admin_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: retention-policy-admin-device" \
  -d '{"username":"admin_demo","password":"devpass123456"}')

if [ "$customer_login_code" != "200" ] || [ "$admin_login_code" != "200" ]; then
  exit 1
fi

customer_token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.accessToken);' /tmp/retention_policy_customer_login.json)
customer_token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.accessToken);' /tmp/retention_policy_customer_login.json)
admin_token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.accessToken);' /tmp/retention_policy_admin_login.json)

node -e '
const fs=require("fs");
const bytes=[
  0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,
  0x00,0x00,0x00,0x0d,0x49,0x48,0x44,0x52,
  0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x01,
  0x08,0x02,0x00,0x00,0x00,0x90,0x77,0x53,
  0xde,0x00,0x00,0x00,0x0a,0x49,0x44,0x41,
  0x54,0x78,0x9c,0x63,0x60,0x00,0x00,0x00,
  0x02,0x00,0x01,0xe5,0x27,0xd4,0xa2,0x00,
  0x00,0x00,0x00,0x49,0x45,0x4e,0x44,0xae,
  0x42,0x60,0x82
];
const bytesA = bytes.concat([0x72,0x65,0x74,0x2d,0x61]);
const bytesB = bytes.concat([0x72,0x65,0x74,0x2d,0x62]);
fs.writeFileSync("/tmp/retention-policy-a.png", Buffer.from(bytesA));
fs.writeFileSync("/tmp/retention-policy-b.png", Buffer.from(bytesB));
'

upload_a_code=$(curl -sS -o /tmp/retention_policy_upload_a.json -w "%{http_code}" -X POST "$base_url/api/media" \
  -H "Authorization: Bearer $customer_token" \
  -F "purpose=ticket" \
  -F "files=@/tmp/retention-policy-a.png;type=image/png")

upload_b_code=$(curl -sS -o /tmp/retention_policy_upload_b.json -w "%{http_code}" -X POST "$base_url/api/media" \
  -H "Authorization: Bearer $customer_token" \
  -F "purpose=ticket" \
  -F "files=@/tmp/retention-policy-b.png;type=image/png")

if [ "$upload_a_code" != "201" ] || [ "$upload_b_code" != "201" ]; then
  exit 1
fi

media_a_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.media[0].mediaId);' /tmp/retention_policy_upload_a.json)
media_b_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.media[0].mediaId);' /tmp/retention_policy_upload_b.json)

fixture_a_code=$(curl -sS -o /tmp/retention_policy_fixture_a.json -w "%{http_code}" -X POST "$base_url/api/internal/test-fixtures/completed-order" \
  -H "X-Internal-Token: $internal_token" \
  -H "Authorization: Bearer $internal_admin_token")
fixture_b_code=$(curl -sS -o /tmp/retention_policy_fixture_b.json -w "%{http_code}" -X POST "$base_url/api/internal/test-fixtures/completed-order" \
  -H "X-Internal-Token: $internal_token" \
  -H "Authorization: Bearer $internal_admin_token")

if [ "$fixture_a_code" != "201" ] || [ "$fixture_b_code" != "201" ]; then
  exit 1
fi

order_a_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.orderId);' /tmp/retention_policy_fixture_a.json)
order_b_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.orderId);' /tmp/retention_policy_fixture_b.json)

create_a_code=$(curl -sS -o /tmp/retention_policy_ticket_a.json -w "%{http_code}" -X POST "$base_url/api/tickets" \
  -H "Authorization: Bearer $customer_token" \
  -H "Content-Type: application/json" \
  -d "{\"orderId\":\"$order_a_id\",\"category\":\"service_issue\",\"description\":\"cleanup candidate\",\"attachmentIds\":[\"$media_a_id\"]}")

create_b_code=$(curl -sS -o /tmp/retention_policy_ticket_b.json -w "%{http_code}" -X POST "$base_url/api/tickets" \
  -H "Authorization: Bearer $customer_token" \
  -H "Content-Type: application/json" \
  -d "{\"orderId\":\"$order_b_id\",\"category\":\"service_issue\",\"description\":\"legal hold candidate\",\"attachmentIds\":[\"$media_b_id\"]}")

if [ "$create_a_code" != "201" ] || [ "$create_b_code" != "201" ]; then
  exit 1
fi

ticket_a_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.id);' /tmp/retention_policy_ticket_a.json)
ticket_b_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.id);' /tmp/retention_policy_ticket_b.json)

resolve_a_code=$(curl -sS -o /tmp/retention_policy_resolve_a.json -w "%{http_code}" -X POST "$base_url/api/tickets/$ticket_a_id/resolve" \
  -H "Authorization: Bearer $admin_token" \
  -H "Content-Type: application/json" \
  -d "{\"summaryText\":\"resolved a\",\"attachmentIds\":[\"$media_a_id\"]}")

resolve_b_code=$(curl -sS -o /tmp/retention_policy_resolve_b.json -w "%{http_code}" -X POST "$base_url/api/tickets/$ticket_b_id/resolve" \
  -H "Authorization: Bearer $admin_token" \
  -H "Content-Type: application/json" \
  -d "{\"summaryText\":\"resolved b\",\"attachmentIds\":[\"$media_b_id\"]}")

hold_b_code=$(curl -sS -o /tmp/retention_policy_hold_b.json -w "%{http_code}" -X POST "$base_url/api/tickets/$ticket_b_id/legal-hold" \
  -H "Authorization: Bearer $admin_token" \
  -H "Content-Type: application/json" \
  -d '{"legalHold":true}')

if [ "$resolve_a_code" != "200" ] || [ "$resolve_b_code" != "200" ] || [ "$hold_b_code" != "200" ]; then
  exit 1
fi

TICKET_A_ID="$ticket_a_id" TICKET_B_ID="$ticket_b_id" node - <<'EOF'
const { MongoClient, ObjectId } = require('./backend/node_modules/mongodb');

const uri = process.env.MONGO_URI || 'mongodb://mongodb:27017/homecareops_test';
const client = new MongoClient(uri);

async function main() {
  const ticketA = process.env.TICKET_A_ID;
  const ticketB = process.env.TICKET_B_ID;
  const old = new Date(Date.now() - 370 * 24 * 60 * 60 * 1000);

  await client.connect();
  const dbName = new URL(uri).pathname.replace(/^\//, '') || 'homecareops_test';
  const db = client.db(dbName);
  const update = await db.collection('tickets').updateMany(
    { _id: { $in: [new ObjectId(ticketA), new ObjectId(ticketB)] } },
    { $set: { updatedAt: old, 'immutableOutcome.resolvedAt': old } },
  );

  if (update.modifiedCount < 2) {
    throw new Error(`Expected to age two tickets, modified ${update.modifiedCount}`);
  }

  const cutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const candidates = await db.collection('tickets').countDocuments({
    status: 'resolved',
    legalHold: { $ne: true },
    cleanedAt: null,
    $or: [{ 'immutableOutcome.resolvedAt': { $lte: cutoff } }, { updatedAt: { $lte: cutoff } }],
  });

  if (candidates < 1) {
    throw new Error('Expected at least one retention cleanup candidate');
  }
}

main().finally(async () => {
  await client.close();
});
EOF

if [ $? -ne 0 ]; then
  exit 1
fi

MONGO_URI="${TEST_MONGO_URI:-mongodb://mongodb:27017/homecareops_test}" npm --prefix ./backend run retention:cleanup

detail_a_code=$(curl -sS -o /tmp/retention_policy_detail_a.json -w "%{http_code}" "$base_url/api/tickets/$ticket_a_id" \
  -H "Authorization: Bearer $admin_token")
detail_b_code=$(curl -sS -o /tmp/retention_policy_detail_b.json -w "%{http_code}" "$base_url/api/tickets/$ticket_b_id" \
  -H "Authorization: Bearer $admin_token")

if [ "$detail_a_code" != "200" ] || [ "$detail_b_code" != "200" ]; then
  exit 1
fi

node -e '
const fs=require("fs");
const a=JSON.parse(fs.readFileSync(process.argv[1],"utf8")).ticket;
const b=JSON.parse(fs.readFileSync(process.argv[2],"utf8")).ticket;
const aCleaned = Array.isArray(a.attachmentIds) && a.attachmentIds.length===0
  && Array.isArray(a.immutableOutcome?.attachmentIds) && a.immutableOutcome.attachmentIds.length===0;
const bHeld = b.legalHold===true
  && Array.isArray(b.attachmentIds) && b.attachmentIds.length>0
  && Array.isArray(b.immutableOutcome?.attachmentIds) && b.immutableOutcome.attachmentIds.length>0;
process.exit(aCleaned && bHeld ? 0 : 1);
' /tmp/retention_policy_detail_a.json /tmp/retention_policy_detail_b.json
