#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"
internal_token="${INTERNAL_ROUTES_TOKEN:-dev-internal-token}"
internal_admin_token="${INTERNAL_ADMIN_TOKEN:-}"

login_code=$(curl -sS -o /tmp/ticket_routing_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: ticket-routing-device" \
  -d '{"username":"customer_demo","password":"devpass123456"}')

fixture_code=$(curl -sS -o /tmp/ticket_routing_fixture.json -w "%{http_code}" -X POST "$base_url/api/internal/test-fixtures/completed-order" \
  -H "X-Internal-Token: $internal_token" \
  -H "Authorization: Bearer $internal_admin_token")

if [ "$login_code" != "200" ] || [ "$fixture_code" != "201" ]; then
  exit 1
fi

token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.accessToken);' /tmp/ticket_routing_login.json)
order_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.orderId);' /tmp/ticket_routing_fixture.json)

create_code=$(curl -sS -o /tmp/ticket_routing_create.json -w "%{http_code}" -X POST "$base_url/api/tickets" \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d "{\"orderId\":\"$order_id\",\"category\":\"billing\",\"description\":\"routing check\"}")

if [ "$create_code" != "201" ]; then
  exit 1
fi

ticket_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.id);' /tmp/ticket_routing_create.json)

detail_code=$(curl -sS -o /tmp/ticket_routing_detail.json -w "%{http_code}" "$base_url/api/tickets/$ticket_id" \
  -H "Authorization: Bearer $token")

if [ "$detail_code" != "200" ]; then
  exit 1
fi

node -e '
const fs=require("fs");
const created=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const detail=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
const createdRoute = created.routing || {};
const ticket = detail.ticket || {};
const detailRoute = ticket.routing || {};
const ok = createdRoute.team === "billing_ops"
  && createdRoute.queue === "billing_queue"
  && detailRoute.team === "billing_ops"
  && detailRoute.queue === "billing_queue"
  && ticket.category === "billing";
process.exit(ok ? 0 : 1);
' /tmp/ticket_routing_create.json /tmp/ticket_routing_detail.json
