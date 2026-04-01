#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"

login_a_code=$(curl -sS -o /tmp/ola_login_a.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: ola-customer-a" \
  -d '{"username":"customer_demo","password":"devpass123456"}')

if [ "$login_a_code" != "200" ]; then
  exit 1
fi

token_a=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.accessToken);' /tmp/ola_login_a.json)

username_b="customer_b_$(date +%s)"
password_b="customer-b-pass-123"

register_b_code=$(curl -sS -o /tmp/ola_register_b.json -w "%{http_code}" -X POST "$base_url/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$username_b\",\"password\":\"$password_b\"}")

if [ "$register_b_code" != "201" ]; then
  exit 1
fi

login_b_code=$(curl -sS -o /tmp/ola_login_b.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: ola-customer-b" \
  -d "{\"username\":\"$username_b\",\"password\":\"$password_b\"}")

if [ "$login_b_code" != "200" ]; then
  exit 1
fi

token_b=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.accessToken);' /tmp/ola_login_b.json)

fixture_code=$(curl -sS -o /tmp/ola_slot_fixture.json -w "%{http_code}" -X POST "$base_url/api/internal/test-fixtures/booking-slot")
if [ "$fixture_code" != "201" ]; then
  exit 1
fi

slot_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.targetSlotId);' /tmp/ola_slot_fixture.json)
slot_start=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.targetStart);' /tmp/ola_slot_fixture.json)
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

quote_code=$(curl -sS -o /tmp/ola_quote_b.json -w "%{http_code}" -X POST "$base_url/api/quote" \
  -H "Authorization: Bearer $token_b" \
  -H "Content-Type: application/json" \
  -d "$quote_payload")

if [ "$quote_code" != "200" ]; then
  exit 1
fi

quote_signature=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.quoteSignature);' /tmp/ola_quote_b.json)

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

order_code=$(curl -sS -o /tmp/ola_order_b.json -w "%{http_code}" -X POST "$base_url/api/orders" \
  -H "Authorization: Bearer $token_b" \
  -H "Content-Type: application/json" \
  -d "$order_payload")

if [ "$order_code" != "201" ]; then
  exit 1
fi

order_id_b=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.orderId);' /tmp/ola_order_b.json)

# Customer A cannot read customer B order
order_read_code=$(curl -sS -o /tmp/ola_order_read_denied.json -w "%{http_code}" "$base_url/api/orders/$order_id_b" \
  -H "Authorization: Bearer $token_a")
if [ "$order_read_code" != "404" ]; then
  exit 1
fi

# Customer A cannot open ticket on customer B order
ticket_create_denied_code=$(curl -sS -o /tmp/ola_ticket_create_denied.json -w "%{http_code}" -X POST "$base_url/api/tickets" \
  -H "Authorization: Bearer $token_a" \
  -H "Content-Type: application/json" \
  -d "{\"orderId\":\"$order_id_b\",\"category\":\"billing\",\"description\":\"not mine\"}")
if [ "$ticket_create_denied_code" != "404" ]; then
  exit 1
fi

# Customer B creates ticket, customer A cannot read it
ticket_create_b_code=$(curl -sS -o /tmp/ola_ticket_b.json -w "%{http_code}" -X POST "$base_url/api/tickets" \
  -H "Authorization: Bearer $token_b" \
  -H "Content-Type: application/json" \
  -d "{\"orderId\":\"$order_id_b\",\"category\":\"billing\",\"description\":\"mine\"}")
if [ "$ticket_create_b_code" != "201" ]; then
  exit 1
fi

ticket_id_b=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.id);' /tmp/ola_ticket_b.json)

ticket_read_denied_code=$(curl -sS -o /tmp/ola_ticket_read_denied.json -w "%{http_code}" "$base_url/api/tickets/$ticket_id_b" \
  -H "Authorization: Bearer $token_a")
if [ "$ticket_read_denied_code" != "404" ]; then
  exit 1
fi

# Customer A cannot submit review on customer B order
review_denied_payload=$(cat <<EOF
{
  "orderId":"$order_id_b",
  "rating":5,
  "tags":["quality"],
  "text":"wrong owner review",
  "mediaIds":[]
}
EOF
)

review_denied_code=$(curl -sS -o /tmp/ola_review_denied.json -w "%{http_code}" -X POST "$base_url/api/reviews" \
  -H "Authorization: Bearer $token_a" \
  -H "Content-Type: application/json" \
  -d "$review_denied_payload")
if [ "$review_denied_code" != "404" ]; then
  exit 1
fi
