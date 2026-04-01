#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"

login_code=$(curl -sS -o /tmp/ticket_missing_order_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: ticket-missing-order-device" \
  -d '{"username":"customer_demo","password":"devpass123456"}')

if [ "$login_code" != "200" ]; then
  exit 1
fi

token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.accessToken) process.exit(1);process.stdout.write(p.accessToken);' /tmp/ticket_missing_order_login.json)

create_code=$(curl -sS -o /tmp/ticket_missing_order_response.json -w "%{http_code}" -X POST "$base_url/api/tickets" \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d '{"category":"billing","description":"Missing order id should fail"}')

if [ "$create_code" != "400" ]; then
  exit 1
fi

node -e '
const fs=require("fs");
const payload=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
process.exit(payload && payload.code === "ORDER_ID_REQUIRED" ? 0 : 1);
' /tmp/ticket_missing_order_response.json
