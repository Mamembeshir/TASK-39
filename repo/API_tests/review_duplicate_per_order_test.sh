#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"
internal_token="${INTERNAL_ROUTES_TOKEN:-dev-internal-token}"
internal_admin_token="${INTERNAL_ADMIN_TOKEN:-}"

login_code=$(curl -sS -o /tmp/review_duplicate_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: review-duplicate-device" \
  -d '{"username":"customer_demo","password":"devpass123456"}')

fixture_code=$(curl -sS -o /tmp/review_duplicate_fixture.json -w "%{http_code}" -X POST "$base_url/api/internal/test-fixtures/completed-order" \
  -H "X-Internal-Token: $internal_token" \
  -H "Authorization: Bearer $internal_admin_token")

if [ "$login_code" != "200" ] || [ "$fixture_code" != "201" ]; then
  exit 1
fi

token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.accessToken);' /tmp/review_duplicate_login.json)
order_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.orderId);' /tmp/review_duplicate_fixture.json)

payload=$(cat <<EOF
{"orderId":"$order_id","rating":5,"tags":["quality","communication"],"text":"first review","mediaIds":[]}
EOF
)

first_code=$(curl -sS -o /tmp/review_duplicate_first.json -w "%{http_code}" -X POST "$base_url/api/reviews" \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d "$payload")

second_code=$(curl -sS -o /tmp/review_duplicate_second.json -w "%{http_code}" -X POST "$base_url/api/reviews" \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d "$payload")

if [ "$first_code" != "201" ] || [ "$second_code" != "409" ]; then
  exit 1
fi

node -e '
const fs=require("fs");
const payload=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
process.exit(payload && payload.code === "REVIEW_ALREADY_EXISTS" ? 0 : 1);
' /tmp/review_duplicate_second.json
