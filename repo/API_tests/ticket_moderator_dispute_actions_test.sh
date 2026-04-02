#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"

customer_login_code=$(curl -sS -o /tmp/ticket_mod_customer_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: ticket-mod-customer-device" \
  -d '{"username":"customer_demo","password":"devpass123456"}')

moderator_login_code=$(curl -sS -o /tmp/ticket_mod_moderator_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: ticket-mod-moderator-device" \
  -d '{"username":"moderator_demo","password":"devpass123456"}')

fixture_code=$(curl -sS -o /tmp/ticket_mod_fixture.json -w "%{http_code}" -X POST "$base_url/api/internal/test-fixtures/completed-order")

if [ "$customer_login_code" != "200" ] || [ "$moderator_login_code" != "200" ] || [ "$fixture_code" != "201" ]; then
  exit 1
fi

customer_token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.accessToken);' /tmp/ticket_mod_customer_login.json)
moderator_token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.accessToken);' /tmp/ticket_mod_moderator_login.json)
order_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.orderId);' /tmp/ticket_mod_fixture.json)

create_code=$(curl -sS -o /tmp/ticket_mod_create.json -w "%{http_code}" -X POST "$base_url/api/tickets" \
  -H "Authorization: Bearer $customer_token" \
  -H "Content-Type: application/json" \
  -d "{\"orderId\":\"$order_id\",\"category\":\"service_issue\",\"description\":\"Need help\"}")

if [ "$create_code" != "201" ]; then
  exit 1
fi

ticket_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.id);' /tmp/ticket_mod_create.json)

mod_hold_code=$(curl -sS -o /tmp/ticket_mod_hold.json -w "%{http_code}" -X POST "$base_url/api/tickets/$ticket_id/legal-hold" \
  -H "Authorization: Bearer $moderator_token" \
  -H "Content-Type: application/json" \
  -d '{"legalHold":true}')

mod_resolve_code=$(curl -sS -o /tmp/ticket_mod_resolve.json -w "%{http_code}" -X POST "$base_url/api/tickets/$ticket_id/resolve" \
  -H "Authorization: Bearer $moderator_token" \
  -H "Content-Type: application/json" \
  -d '{"summaryText":"Resolved by moderator"}')

customer_hold_code=$(curl -sS -o /tmp/ticket_mod_customer_hold.json -w "%{http_code}" -X POST "$base_url/api/tickets/$ticket_id/legal-hold" \
  -H "Authorization: Bearer $customer_token" \
  -H "X-Expected-Auth-Failure: 1" \
  -H "Content-Type: application/json" \
  -d '{"legalHold":false}')

customer_resolve_code=$(curl -sS -o /tmp/ticket_mod_customer_resolve.json -w "%{http_code}" -X POST "$base_url/api/tickets/$ticket_id/resolve" \
  -H "Authorization: Bearer $customer_token" \
  -H "X-Expected-Auth-Failure: 1" \
  -H "Content-Type: application/json" \
  -d '{"summaryText":"Customer should not resolve"}')

detail_code=$(curl -sS -o /tmp/ticket_mod_detail.json -w "%{http_code}" "$base_url/api/tickets/$ticket_id" \
  -H "Authorization: Bearer $moderator_token")

if [ "$mod_hold_code" != "200" ] || [ "$mod_resolve_code" != "200" ] || [ "$detail_code" != "200" ] || [ "$customer_hold_code" != "403" ] || [ "$customer_resolve_code" != "403" ]; then
  exit 1
fi

node -e '
const fs=require("fs");
const hold=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const resolve=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
const detail=JSON.parse(fs.readFileSync(process.argv[3],"utf8"));
const ticket=detail.ticket;
const ok = hold.legalHold === true
  && resolve.status === "resolved"
  && resolve.immutableOutcome
  && resolve.immutableOutcome.summaryText === "Resolved by moderator"
  && ticket
  && ticket.legalHold === true
  && ticket.status === "resolved"
  && ticket.immutableOutcome
  && ticket.immutableOutcome.summaryText === "Resolved by moderator";
process.exit(ok ? 0 : 1);
' /tmp/ticket_mod_hold.json /tmp/ticket_mod_resolve.json /tmp/ticket_mod_detail.json
