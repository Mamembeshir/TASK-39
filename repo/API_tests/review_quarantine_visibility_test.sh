#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"
internal_token="${INTERNAL_ROUTES_TOKEN:-dev-internal-token}"
internal_admin_token="${INTERNAL_ADMIN_TOKEN:-}"
service_id="65f000000000000000000101"

login_code=$(curl -sS -o /tmp/review_quarantine_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: review-quarantine-device" \
  -d '{"username":"customer_demo","password":"devpass123456"}')

if [ "$login_code" != "200" ]; then
  exit 1
fi

token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.accessToken) process.exit(1);process.stdout.write(p.accessToken);' /tmp/review_quarantine_login.json)

fixture_code=$(curl -sS -o /tmp/review_quarantine_fixture.json -w "%{http_code}" -X POST "$base_url/api/internal/test-fixtures/completed-order" \
  -H "X-Internal-Token: $internal_token" \
  -H "Authorization: Bearer $internal_admin_token")
if [ "$fixture_code" != "201" ]; then
  exit 1
fi

order_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.orderId)process.exit(1);process.stdout.write(p.orderId);' /tmp/review_quarantine_fixture.json)

review_payload=$(cat <<EOF
{
  "orderId":"$order_id",
  "rating":4,
  "tags":["quality","communication"],
  "text":"This contains fraud keyword to trigger moderation.",
  "mediaIds":[]
}
EOF
)

create_code=$(curl -sS -o /tmp/review_quarantine_create.json -w "%{http_code}" -X POST "$base_url/api/reviews" \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d "$review_payload")

if [ "$create_code" != "201" ]; then
  exit 1
fi

review_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.id)process.exit(1);if(p.status!=="quarantined")process.exit(2);process.stdout.write(p.id);' /tmp/review_quarantine_create.json)

list_code=$(curl -sS -o /tmp/review_quarantine_list.json -w "%{http_code}" "$base_url/api/services/$service_id/reviews")
if [ "$list_code" != "200" ]; then
  exit 1
fi

node -e '
const fs=require("fs");
const payload=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const reviewId=process.argv[2];
const found=(payload.reviews||[]).some((r)=>r.id===reviewId);
process.exit(found ? 1 : 0);
' /tmp/review_quarantine_list.json "$review_id"
