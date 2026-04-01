#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"

customer_login_code=$(curl -sS -o /tmp/ticket_resolve_customer_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: ticket-resolve-customer-device" \
  -d '{"username":"customer_demo","password":"devpass123456"}')

if [ "$customer_login_code" != "200" ]; then
  exit 1
fi

customer_token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.accessToken) process.exit(1);process.stdout.write(p.accessToken);' /tmp/ticket_resolve_customer_login.json)

admin_login_code=$(curl -sS -o /tmp/ticket_resolve_admin_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: ticket-resolve-admin-device" \
  -d '{"username":"admin_demo","password":"devpass123456"}')

if [ "$admin_login_code" != "200" ]; then
  exit 1
fi

admin_token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.accessToken) process.exit(1);process.stdout.write(p.accessToken);' /tmp/ticket_resolve_admin_login.json)

fixture_code=$(curl -sS -o /tmp/ticket_resolve_fixture.json -w "%{http_code}" -X POST "$base_url/api/internal/test-fixtures/completed-order")
if [ "$fixture_code" != "201" ]; then
  exit 1
fi

order_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.orderId)process.exit(1);process.stdout.write(p.orderId);' /tmp/ticket_resolve_fixture.json)

create_payload=$(cat <<EOF
{"orderId":"$order_id","category":"service_issue","description":"Need help"}
EOF
)

create_code=$(curl -sS -o /tmp/ticket_resolve_create.json -w "%{http_code}" -X POST "$base_url/api/tickets" \
  -H "Authorization: Bearer $customer_token" \
  -H "Content-Type: application/json" \
  -d "$create_payload")

if [ "$create_code" != "201" ]; then
  exit 1
fi

ticket_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.id)process.exit(1);process.stdout.write(p.id);' /tmp/ticket_resolve_create.json)

first_resolve_code=$(curl -sS -o /tmp/ticket_resolve_first.json -w "%{http_code}" -X POST "$base_url/api/tickets/$ticket_id/resolve" \
  -H "Authorization: Bearer $admin_token" \
  -H "Content-Type: application/json" \
  -d '{"summaryText":"Resolved first time"}')

if [ "$first_resolve_code" != "200" ]; then
  exit 1
fi

second_resolve_code=$(curl -sS -o /tmp/ticket_resolve_second.json -w "%{http_code}" -X POST "$base_url/api/tickets/$ticket_id/resolve" \
  -H "Authorization: Bearer $admin_token" \
  -H "Content-Type: application/json" \
  -d '{"summaryText":"Trying to modify immutable outcome"}')

status_after_resolve_code=$(curl -sS -o /tmp/ticket_resolve_status_after.json -w "%{http_code}" -X POST "$base_url/api/tickets/$ticket_id/status" \
  -H "Authorization: Bearer $admin_token" \
  -H "Content-Type: application/json" \
  -d '{"status":"open"}')

if [ "$second_resolve_code" != "409" ] || [ "$status_after_resolve_code" != "409" ]; then
  exit 1
fi

node -e '
const fs=require("fs");
const secondResolve=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const statusAfterResolve=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
const ok = secondResolve && secondResolve.code === "IMMUTABLE_OUTCOME"
  && statusAfterResolve && statusAfterResolve.code === "IMMUTABLE_OUTCOME";
process.exit(ok ? 0 : 1);
' /tmp/ticket_resolve_second.json /tmp/ticket_resolve_status_after.json
