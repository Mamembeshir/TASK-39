#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"
internal_token="${INTERNAL_ROUTES_TOKEN:-dev-internal-token}"
internal_admin_token="${INTERNAL_ADMIN_TOKEN:-}"
service_id="65f000000000000000000101"

login_code=$(curl -sS -o /tmp/review_verified_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: review-verified-device" \
  -d '{"username":"customer_demo","password":"devpass123456"}')

fixture_code=$(curl -sS -o /tmp/review_verified_fixture.json -w "%{http_code}" -X POST "$base_url/api/internal/test-fixtures/completed-order" \
  -H "X-Internal-Token: $internal_token" \
  -H "Authorization: Bearer $internal_admin_token")

if [ "$login_code" != "200" ] || [ "$fixture_code" != "201" ]; then
  exit 1
fi

token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.accessToken);' /tmp/review_verified_login.json)
order_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.orderId);' /tmp/review_verified_fixture.json)

create_code=$(curl -sS -o /tmp/review_verified_create.json -w "%{http_code}" -X POST "$base_url/api/reviews" \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d "{\"orderId\":\"$order_id\",\"rating\":5,\"tags\":[\"quality\",\"communication\"],\"text\":\"Helpful and on time\",\"mediaIds\":[]}")

list_code=$(curl -sS -o /tmp/review_verified_list.json -w "%{http_code}" "$base_url/api/services/$service_id/reviews")

if [ "$create_code" != "201" ] || [ "$list_code" != "200" ]; then
  exit 1
fi

node -e '
const fs=require("fs");
const created=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const listed=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
const id=created.id;
const statusOk=created.status==="approved" || created.status==="published";
const visible=(listed.reviews||[]).some((r)=>r.id===id);
process.exit(statusOk && visible ? 0 : 1);
' /tmp/review_verified_create.json /tmp/review_verified_list.json
