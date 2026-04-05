#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"
internal_token="${INTERNAL_ROUTES_TOKEN:-dev-internal-token}"
internal_admin_token="${INTERNAL_ADMIN_TOKEN:-}"

customer_login_code=$(curl -sS -o /tmp/ticket_status_policy_customer_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: ticket-status-policy-customer-device" \
  -d '{"username":"customer_demo","password":"devpass123456"}')

admin_login_code=$(curl -sS -o /tmp/ticket_status_policy_admin_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: ticket-status-policy-admin-device" \
  -d '{"username":"admin_demo","password":"devpass123456"}')

fixture_code=$(curl -sS -o /tmp/ticket_status_policy_fixture.json -w "%{http_code}" -X POST "$base_url/api/internal/test-fixtures/completed-order" \
  -H "X-Internal-Token: $internal_token" \
  -H "Authorization: Bearer $internal_admin_token")

if [ "$customer_login_code" != "200" ] || [ "$admin_login_code" != "200" ] || [ "$fixture_code" != "201" ]; then
  exit 1
fi

customer_token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.accessToken);' /tmp/ticket_status_policy_customer_login.json)
admin_token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.accessToken);' /tmp/ticket_status_policy_admin_login.json)
order_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.orderId);' /tmp/ticket_status_policy_fixture.json)

create_code=$(curl -sS -o /tmp/ticket_status_policy_create.json -w "%{http_code}" -X POST "$base_url/api/tickets" \
  -H "Authorization: Bearer $customer_token" \
  -H "Content-Type: application/json" \
  -d "{\"orderId\":\"$order_id\",\"category\":\"service_issue\",\"description\":\"Need help\"}")

if [ "$create_code" != "201" ]; then
  exit 1
fi

ticket_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.id);' /tmp/ticket_status_policy_create.json)

customer_forbidden_code=$(curl -sS -o /tmp/ticket_status_policy_customer_forbidden.json -w "%{http_code}" -X POST "$base_url/api/tickets/$ticket_id/status" \
  -H "Authorization: Bearer $customer_token" \
  -H "Content-Type: application/json" \
  -d '{"status":"waiting_on_customer"}')

staff_pause_code=$(curl -sS -o /tmp/ticket_status_policy_staff_pause.json -w "%{http_code}" -X POST "$base_url/api/tickets/$ticket_id/status" \
  -H "Authorization: Bearer $admin_token" \
  -H "Content-Type: application/json" \
  -d '{"status":"waiting_on_customer"}')

customer_resume_code=$(curl -sS -o /tmp/ticket_status_policy_customer_resume.json -w "%{http_code}" -X POST "$base_url/api/tickets/$ticket_id/status" \
  -H "Authorization: Bearer $customer_token" \
  -H "Content-Type: application/json" \
  -d '{"status":"open"}')

staff_invalid_status_code=$(curl -sS -o /tmp/ticket_status_policy_staff_invalid.json -w "%{http_code}" -X POST "$base_url/api/tickets/$ticket_id/status" \
  -H "Authorization: Bearer $admin_token" \
  -H "Content-Type: application/json" \
  -d '{"status":"closed"}')

if [ "$customer_forbidden_code" != "403" ] || [ "$staff_pause_code" != "200" ] || [ "$customer_resume_code" != "200" ] || [ "$staff_invalid_status_code" != "400" ]; then
  exit 1
fi

node -e '
const fs=require("fs");
const forbidden=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const staffPause=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
const customerResume=JSON.parse(fs.readFileSync(process.argv[3],"utf8"));
const invalid=JSON.parse(fs.readFileSync(process.argv[4],"utf8"));
const ok = forbidden.code === "FORBIDDEN_STATUS_TRANSITION"
  && staffPause.status === "waiting_on_customer"
  && customerResume.status === "open"
  && invalid.code === "INVALID_STATUS";
process.exit(ok ? 0 : 1);
' /tmp/ticket_status_policy_customer_forbidden.json /tmp/ticket_status_policy_staff_pause.json /tmp/ticket_status_policy_customer_resume.json /tmp/ticket_status_policy_staff_invalid.json
