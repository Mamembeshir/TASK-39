#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"
internal_token="${INTERNAL_ROUTES_TOKEN:-dev-internal-token}"
internal_admin_token="${INTERNAL_ADMIN_TOKEN:-}"

login_code=$(curl -sS -o /tmp/ticket_frontend_routing_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: ticket-frontend-routing-device" \
  -d '{"username":"customer_demo","password":"devpass123456"}')

fixture_code=$(curl -sS -o /tmp/ticket_frontend_routing_fixture.json -w "%{http_code}" -X POST "$base_url/api/internal/test-fixtures/completed-order" \
  -H "X-Internal-Token: $internal_token" \
  -H "Authorization: Bearer $internal_admin_token")

if [ "$login_code" != "200" ] || [ "$fixture_code" != "201" ]; then
  exit 1
fi

token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.accessToken);' /tmp/ticket_frontend_routing_login.json)
order_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.orderId);' /tmp/ticket_frontend_routing_fixture.json)

create_code=$(curl -sS -o /tmp/ticket_frontend_routing_create.json -w "%{http_code}" -X POST "$base_url/api/tickets" \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d "{\"orderId\":\"$order_id\",\"category\":\"service_quality\",\"description\":\"routing check\"}")

if [ "$create_code" != "201" ]; then
  exit 1
fi

node -e '
const fs=require("fs");
const created=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const route=created.routing || {};
const ok = route.team === "service_ops"
  && route.queue === "service_recovery_queue";
process.exit(ok ? 0 : 1);
' /tmp/ticket_frontend_routing_create.json
