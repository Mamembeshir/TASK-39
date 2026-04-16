#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"
internal_token="${INTERNAL_ROUTES_TOKEN:-dev-internal-token}"
internal_admin_token="${INTERNAL_ADMIN_TOKEN:-}"

login_code=$(curl -sS -o /tmp/tickets_list_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: tickets-list-a" \
  -d '{"username":"customer_demo","password":"devpass123456"}')

if [ "$login_code" != "200" ]; then
  exit 1
fi

token_a=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.accessToken);' /tmp/tickets_list_login.json)

fixture_code=$(curl -sS -o /tmp/tickets_list_fixture.json -w "%{http_code}" -X POST "$base_url/api/internal/test-fixtures/completed-order" \
  -H "X-Internal-Token: $internal_token" \
  -H "Authorization: Bearer $internal_admin_token")
if [ "$fixture_code" != "201" ]; then
  exit 1
fi

order_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.orderId);' /tmp/tickets_list_fixture.json)

create_code=$(curl -sS -o /tmp/tickets_list_create.json -w "%{http_code}" -X POST "$base_url/api/tickets" \
  -H "Authorization: Bearer $token_a" \
  -H "Content-Type: application/json" \
  -d "{\"orderId\":\"$order_id\",\"category\":\"billing\",\"description\":\"Need help\"}")

if [ "$create_code" != "201" ]; then
  exit 1
fi

ticket_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.id);' /tmp/tickets_list_create.json)

list_a_code=$(curl -sS -o /tmp/tickets_list_a.json -w "%{http_code}" "$base_url/api/tickets" \
  -H "Authorization: Bearer $token_a")

if [ "$list_a_code" != "200" ]; then
  exit 1
fi

node -e '
const fs=require("fs");
const payload=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
if (!Array.isArray(payload) || !payload.some((ticket) => ticket.id === process.argv[2])) process.exit(1);
' /tmp/tickets_list_a.json "$ticket_id"

username_b="tickets_list_b_$(date +%s)"
password_b="customer-b-pass-123"

register_b_code=$(curl -sS -o /tmp/tickets_list_register_b.json -w "%{http_code}" -X POST "$base_url/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$username_b\",\"password\":\"$password_b\"}")

if [ "$register_b_code" != "201" ]; then
  exit 1
fi

login_b_code=$(curl -sS -o /tmp/tickets_list_login_b.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: tickets-list-b" \
  -d "{\"username\":\"$username_b\",\"password\":\"$password_b\"}")

if [ "$login_b_code" != "200" ]; then
  exit 1
fi

token_b=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.accessToken);' /tmp/tickets_list_login_b.json)

list_b_code=$(curl -sS -o /tmp/tickets_list_b.json -w "%{http_code}" "$base_url/api/tickets" \
  -H "Authorization: Bearer $token_b")

if [ "$list_b_code" != "200" ]; then
  exit 1
fi

node -e '
const fs=require("fs");
const payload=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
if (!Array.isArray(payload)) process.exit(1);
if (payload.some((ticket) => ticket.id === process.argv[2])) process.exit(1);
' /tmp/tickets_list_b.json "$ticket_id"
