#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"
internal_token="${INTERNAL_ROUTES_TOKEN:-dev-internal-token}"
internal_admin_token="${INTERNAL_ADMIN_TOKEN:-}"

customer_login_code=$(curl -sS -o /tmp/mod_reject_customer_login.json -w "%{http_code}" \
  -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: mod-reject-customer" \
  -d '{"username":"customer_demo","password":"devpass123456"}')

mod_login_code=$(curl -sS -o /tmp/mod_reject_mod_login.json -w "%{http_code}" \
  -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: mod-reject-mod" \
  -d '{"username":"moderator_demo","password":"devpass123456"}')

fixture_code=$(curl -sS -o /tmp/mod_reject_fixture.json -w "%{http_code}" \
  -X POST "$base_url/api/internal/test-fixtures/completed-order" \
  -H "X-Internal-Token: $internal_token" \
  -H "Authorization: Bearer $internal_admin_token")

if [ "$customer_login_code" != "200" ] || [ "$mod_login_code" != "200" ] || [ "$fixture_code" != "201" ]; then
  exit 1
fi

customer_token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.accessToken);' /tmp/mod_reject_customer_login.json)
mod_token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.accessToken);' /tmp/mod_reject_mod_login.json)
order_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.orderId)process.exit(1);process.stdout.write(p.orderId);' /tmp/mod_reject_fixture.json)

# Submit a review with a flagged keyword to place it in the quarantine queue
review_code=$(curl -sS -o /tmp/mod_reject_review.json -w "%{http_code}" \
  -X POST "$base_url/api/reviews" \
  -H "Authorization: Bearer $customer_token" \
  -H "Content-Type: application/json" \
  -d "{\"orderId\":\"$order_id\",\"rating\":1,\"tags\":[\"quality\"],\"text\":\"This contains fraud keyword to trigger moderation.\",\"mediaIds\":[]}")

if [ "$review_code" != "201" ]; then exit 1; fi

review_id=$(node -e '
const fs=require("fs");
const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
if(!p.id)process.exit(1);
process.stdout.write(p.id);
' /tmp/mod_reject_review.json)

# POST /api/moderation/reviews/:id/reject
reject_code=$(curl -sS -o /tmp/mod_reject_result.json -w "%{http_code}" \
  -X POST "$base_url/api/moderation/reviews/$review_id/reject" \
  -H "Authorization: Bearer $mod_token")

if [ "$reject_code" != "200" ]; then exit 1; fi

node -e '
const fs=require("fs");
const payload=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
process.exit(payload ? 0 : 1);
' /tmp/mod_reject_result.json
