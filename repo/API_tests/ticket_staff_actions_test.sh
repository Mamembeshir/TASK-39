#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"

customer_login_code=$(curl -sS -o /tmp/ticket_staff_customer_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: ticket-staff-customer-device" \
  -d '{"username":"customer_demo","password":"devpass123456"}')

admin_login_code=$(curl -sS -o /tmp/ticket_staff_admin_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: ticket-staff-admin-device" \
  -d '{"username":"admin_demo","password":"devpass123456"}')

fixture_code=$(curl -sS -o /tmp/ticket_staff_fixture.json -w "%{http_code}" -X POST "$base_url/api/internal/test-fixtures/completed-order")

if [ "$customer_login_code" != "200" ] || [ "$admin_login_code" != "200" ] || [ "$fixture_code" != "201" ]; then
  exit 1
fi

customer_token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.accessToken);' /tmp/ticket_staff_customer_login.json)
admin_token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.accessToken);' /tmp/ticket_staff_admin_login.json)
order_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.orderId);' /tmp/ticket_staff_fixture.json)

create_code=$(curl -sS -o /tmp/ticket_staff_create.json -w "%{http_code}" -X POST "$base_url/api/tickets" \
  -H "Authorization: Bearer $customer_token" \
  -H "Content-Type: application/json" \
  -d "{\"orderId\":\"$order_id\",\"category\":\"service_issue\",\"description\":\"Need help\"}")

if [ "$create_code" != "201" ]; then
  exit 1
fi

ticket_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.id);' /tmp/ticket_staff_create.json)

hold_code=$(curl -sS -o /tmp/ticket_staff_hold.json -w "%{http_code}" -X POST "$base_url/api/tickets/$ticket_id/legal-hold" \
  -H "Authorization: Bearer $admin_token" \
  -H "Content-Type: application/json" \
  -d '{"legalHold":true}')

pause_code=$(curl -sS -o /tmp/ticket_staff_pause.json -w "%{http_code}" -X POST "$base_url/api/tickets/$ticket_id/status" \
  -H "Authorization: Bearer $admin_token" \
  -H "Content-Type: application/json" \
  -d '{"status":"waiting_on_customer"}')

resume_code=$(curl -sS -o /tmp/ticket_staff_resume.json -w "%{http_code}" -X POST "$base_url/api/tickets/$ticket_id/status" \
  -H "Authorization: Bearer $admin_token" \
  -H "Content-Type: application/json" \
  -d '{"status":"open"}')

detail_code=$(curl -sS -o /tmp/ticket_staff_detail.json -w "%{http_code}" "$base_url/api/tickets/$ticket_id" \
  -H "Authorization: Bearer $admin_token")

if [ "$hold_code" != "200" ] || [ "$pause_code" != "200" ] || [ "$resume_code" != "200" ] || [ "$detail_code" != "200" ]; then
  exit 1
fi

node -e '
const fs=require("fs");
const hold=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const pause=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
const resume=JSON.parse(fs.readFileSync(process.argv[3],"utf8"));
const detail=JSON.parse(fs.readFileSync(process.argv[4],"utf8"));
const ticket=detail.ticket;
const ok = hold.legalHold === true
  && pause.status === "waiting_on_customer"
  && resume.status === "open"
  && ticket.legalHold === true
  && ticket.sla
  && ticket.sla.isPaused === false
  && ticket.status === "open";
process.exit(ok ? 0 : 1);
' /tmp/ticket_staff_hold.json /tmp/ticket_staff_pause.json /tmp/ticket_staff_resume.json /tmp/ticket_staff_detail.json
