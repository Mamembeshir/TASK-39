#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"
internal_token="${INTERNAL_ROUTES_TOKEN:-dev-internal-token}"
internal_admin_token="${INTERNAL_ADMIN_TOKEN:-}"
cookie_file="/tmp/order_concurrency.cookies"

login_code=$(curl -sS -c "$cookie_file" -o /tmp/order_concurrency_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: order-concurrency-device" \
  -d '{"username":"customer_demo","password":"devpass123456"}')

if [ "$login_code" != "200" ]; then
  exit 1
fi

fixture_code=$(curl -sS -o /tmp/order_concurrency_fixture.json -w "%{http_code}" -X POST "$base_url/api/internal/test-fixtures/booking-slot" \
  -H "X-Internal-Token: $internal_token" \
  -H "Authorization: Bearer $internal_admin_token")
if [ "$fixture_code" != "201" ]; then
  exit 1
fi

slot_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.targetSlotId) process.exit(1);process.stdout.write(p.targetSlotId);' /tmp/order_concurrency_fixture.json)
slot_start=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.targetStart) process.exit(1);process.stdout.write(p.targetStart);' /tmp/order_concurrency_fixture.json)
booking_requested_at=$(node -e 'process.stdout.write(new Date().toISOString())')

quote_payload=$(cat <<EOF
{
  "lineItems":[
    {"type":"service","serviceId":"65f000000000000000000101","durationMinutes":30,"quantity":1}
  ],
  "slotStart":"$slot_start",
  "bookingRequestedAt":"$booking_requested_at",
  "milesFromDepot":8,
  "jurisdictionId":"US-OR-PDX"
}
EOF
)

quote_code=$(curl -sS -o /tmp/order_concurrency_quote.json -w "%{http_code}" -X POST "$base_url/api/quote" \
  -b "$cookie_file" \
  -H "Content-Type: application/json" \
  -d "$quote_payload")

if [ "$quote_code" != "200" ]; then
  exit 1
fi

quote_signature=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.quoteSignature) process.exit(1);process.stdout.write(p.quoteSignature);' /tmp/order_concurrency_quote.json)

order_payload=$(cat <<EOF
{
  "lineItems":[
    {"type":"service","serviceId":"65f000000000000000000101","durationMinutes":30,"quantity":1}
  ],
  "slotId":"$slot_id",
  "bookingRequestedAt":"$booking_requested_at",
  "milesFromDepot":8,
  "jurisdictionId":"US-OR-PDX",
  "quoteSignature":"$quote_signature"
}
EOF
)

(
  curl -sS -o /tmp/order_concurrency_a.json -w "%{http_code}" -X POST "$base_url/api/orders" \
    -b "$cookie_file" \
    -H "Content-Type: application/json" \
    -d "$order_payload" > /tmp/order_concurrency_a.code
) &

(
  curl -sS -o /tmp/order_concurrency_b.json -w "%{http_code}" -X POST "$base_url/api/orders" \
    -b "$cookie_file" \
    -H "Content-Type: application/json" \
    -d "$order_payload" > /tmp/order_concurrency_b.code
) &

wait

code_a=$(tr -d '\n' < /tmp/order_concurrency_a.code)
code_b=$(tr -d '\n' < /tmp/order_concurrency_b.code)

if [ "$code_a" = "201" ] && [ "$code_b" = "409" ]; then
  loser_file="/tmp/order_concurrency_b.json"
elif [ "$code_b" = "201" ] && [ "$code_a" = "409" ]; then
  loser_file="/tmp/order_concurrency_a.json"
else
  exit 1
fi

node -e '
const fs=require("fs");
const payload=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const ok = payload && payload.code === "SLOT_UNAVAILABLE" && Array.isArray(payload.alternatives) && payload.alternatives.length > 0;
process.exit(ok ? 0 : 1);
' "$loser_file"
