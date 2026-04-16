#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"
internal_token="${INTERNAL_ROUTES_TOKEN:-dev-internal-token}"
internal_admin_token="${INTERNAL_ADMIN_TOKEN:-}"

login_a_code=$(curl -sS -o /tmp/orders_list_login_a.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: orders-list-a" \
  -d '{"username":"customer_demo","password":"devpass123456"}')

if [ "$login_a_code" != "200" ]; then
  exit 1
fi

token_a=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.accessToken);' /tmp/orders_list_login_a.json)

fixture_code=$(curl -sS -o /tmp/orders_list_fixture.json -w "%{http_code}" -X POST "$base_url/api/internal/test-fixtures/booking-slot" \
  -H "X-Internal-Token: $internal_token" \
  -H "Authorization: Bearer $internal_admin_token")
if [ "$fixture_code" != "201" ]; then
  exit 1
fi

slot_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.targetSlotId);' /tmp/orders_list_fixture.json)
slot_start=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.targetStart);' /tmp/orders_list_fixture.json)
booking_requested_at=$(node -e 'process.stdout.write(new Date().toISOString())')

quote_payload=$(cat <<EOF
{
  "lineItems":[{"type":"service","serviceId":"65f000000000000000000101","durationMinutes":30,"quantity":1}],
  "slotStart":"$slot_start",
  "bookingRequestedAt":"$booking_requested_at",
  "milesFromDepot":8,
  "jurisdictionId":"US-OR-PDX"
}
EOF
)

quote_code=$(curl -sS -o /tmp/orders_list_quote.json -w "%{http_code}" -X POST "$base_url/api/quote" \
  -H "Authorization: Bearer $token_a" \
  -H "Content-Type: application/json" \
  -d "$quote_payload")

if [ "$quote_code" != "200" ]; then
  exit 1
fi

quote_signature=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.quoteSignature);' /tmp/orders_list_quote.json)

order_payload=$(cat <<EOF
{
  "lineItems":[{"type":"service","serviceId":"65f000000000000000000101","durationMinutes":30,"quantity":1}],
  "slotId":"$slot_id",
  "bookingRequestedAt":"$booking_requested_at",
  "milesFromDepot":8,
  "jurisdictionId":"US-OR-PDX",
  "quoteSignature":"$quote_signature"
}
EOF
)

order_code=$(curl -sS -o /tmp/orders_list_order.json -w "%{http_code}" -X POST "$base_url/api/orders" \
  -H "Authorization: Bearer $token_a" \
  -H "Content-Type: application/json" \
  -d "$order_payload")

if [ "$order_code" != "201" ]; then
  exit 1
fi

order_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.orderId);' /tmp/orders_list_order.json)

list_a_code=$(curl -sS -o /tmp/orders_list_a.json -w "%{http_code}" "$base_url/api/orders" \
  -H "Authorization: Bearer $token_a")

if [ "$list_a_code" != "200" ]; then
  exit 1
fi

node -e '
const fs=require("fs");
const payload=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
if (!Array.isArray(payload) || !payload.some((order) => order.id === process.argv[2])) process.exit(1);
' /tmp/orders_list_a.json "$order_id"

username_b="orders_list_b_$(date +%s)"
password_b="customer-b-pass-123"

register_b_code=$(curl -sS -o /tmp/orders_list_register_b.json -w "%{http_code}" -X POST "$base_url/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$username_b\",\"password\":\"$password_b\"}")

if [ "$register_b_code" != "201" ]; then
  exit 1
fi

login_b_code=$(curl -sS -o /tmp/orders_list_login_b.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: orders-list-b" \
  -d "{\"username\":\"$username_b\",\"password\":\"$password_b\"}")

if [ "$login_b_code" != "200" ]; then
  exit 1
fi

token_b=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.accessToken);' /tmp/orders_list_login_b.json)

list_b_code=$(curl -sS -o /tmp/orders_list_b.json -w "%{http_code}" "$base_url/api/orders" \
  -H "Authorization: Bearer $token_b")

if [ "$list_b_code" != "200" ]; then
  exit 1
fi

node -e '
const fs=require("fs");
const payload=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
if (!Array.isArray(payload)) process.exit(1);
if (payload.some((order) => order.id === process.argv[2])) process.exit(1);
' /tmp/orders_list_b.json "$order_id"
