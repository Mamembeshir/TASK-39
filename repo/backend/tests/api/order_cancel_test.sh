#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"
internal_token="${INTERNAL_ROUTES_TOKEN:-dev-internal-token}"
internal_admin_token="${INTERNAL_ADMIN_TOKEN:-}"

# Login as customer
login_code=$(curl -sS -o /tmp/order_cancel_login.json -w "%{http_code}" \
  -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: order-cancel-device" \
  -d '{"username":"customer_demo","password":"devpass123456"}')

if [ "$login_code" != "200" ]; then exit 1; fi

token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.accessToken)process.exit(1);process.stdout.write(p.accessToken);' /tmp/order_cancel_login.json)

# Create a booking slot fixture
fixture_code=$(curl -sS -o /tmp/order_cancel_fixture.json -w "%{http_code}" \
  -X POST "$base_url/api/internal/test-fixtures/booking-slot" \
  -H "X-Internal-Token: $internal_token" \
  -H "Authorization: Bearer $internal_admin_token")

if [ "$fixture_code" != "201" ]; then exit 1; fi

slot_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.targetSlotId);' /tmp/order_cancel_fixture.json)
slot_start=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.targetStart);' /tmp/order_cancel_fixture.json)
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

quote_code=$(curl -sS -o /tmp/order_cancel_quote.json -w "%{http_code}" \
  -X POST "$base_url/api/quote" \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d "$quote_payload")

if [ "$quote_code" != "200" ]; then exit 1; fi

quote_signature=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.quoteSignature);' /tmp/order_cancel_quote.json)

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

order_code=$(curl -sS -o /tmp/order_cancel_order.json -w "%{http_code}" \
  -X POST "$base_url/api/orders" \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d "$order_payload")

if [ "$order_code" != "201" ]; then exit 1; fi

order_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.orderId)process.exit(1);process.stdout.write(p.orderId);' /tmp/order_cancel_order.json)

# POST /api/orders/:id/cancel
cancel_code=$(curl -sS -o /tmp/order_cancel_result.json -w "%{http_code}" \
  -X POST "$base_url/api/orders/$order_id/cancel" \
  -H "Authorization: Bearer $token")

if [ "$cancel_code" != "200" ]; then exit 1; fi

node -e '
const fs=require("fs");
const payload=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
process.exit(payload && payload.status==="ok" ? 0 : 1);
' /tmp/order_cancel_result.json
