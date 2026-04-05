#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"
internal_token="${INTERNAL_ROUTES_TOKEN:-dev-internal-token}"
internal_admin_token="${INTERNAL_ADMIN_TOKEN:-}"
fixed_now="2026-03-30T16:00:00.000Z"

login_code=$(curl -sS -o /tmp/ticket_sla_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: ticket-sla-device" \
  -d '{"username":"customer_demo","password":"devpass123456"}')

if [ "$login_code" != "200" ]; then
  exit 1
fi

token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.accessToken) process.exit(1);process.stdout.write(p.accessToken);' /tmp/ticket_sla_login.json)

fixture_code=$(curl -sS -o /tmp/ticket_sla_fixture.json -w "%{http_code}" -X POST "$base_url/api/internal/test-fixtures/completed-order" \
  -H "X-Internal-Token: $internal_token" \
  -H "Authorization: Bearer $internal_admin_token")
if [ "$fixture_code" != "201" ]; then
  exit 1
fi

order_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.orderId)process.exit(1);process.stdout.write(p.orderId);' /tmp/ticket_sla_fixture.json)

create_payload=$(cat <<EOF
{"orderId":"$order_id","category":"billing","description":"SLA fixture test"}
EOF
)

create_code=$(curl -sS -o /tmp/ticket_sla_create.json -w "%{http_code}" -X POST "$base_url/api/tickets" \
  -H "Authorization: Bearer $token" \
  -H "X-Test-Now: $fixed_now" \
  -H "Content-Type: application/json" \
  -d "$create_payload")

if [ "$create_code" != "201" ]; then
  exit 1
fi

ticket_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.id)process.exit(1);process.stdout.write(p.id);' /tmp/ticket_sla_create.json)

get_code=$(curl -sS -o /tmp/ticket_sla_get.json -w "%{http_code}" "$base_url/api/tickets/$ticket_id" \
  -H "Authorization: Bearer $token")

if [ "$get_code" != "200" ]; then
  exit 1
fi

node -e '
const fs=require("fs");
const { computeSlaDeadlines } = require("./backend/src/sla");
const { SLA_FIRST_RESPONSE_MINUTES, SLA_RESOLUTION_MINUTES } = require("./backend/src/config/appConstants");
const createdAt = new Date(process.argv[2]);
const payload = JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const ticket = payload.ticket;
if (!ticket || !ticket.sla || !ticket.sla.firstResponseDueAt || !ticket.sla.resolutionDueAt) {
  process.exit(1);
}

const businessHours = {
  monday: { start: "09:00", end: "17:00" },
  tuesday: { start: "09:00", end: "17:00" },
  wednesday: { start: "09:00", end: "17:00" },
  thursday: { start: "09:00", end: "17:00" },
  friday: { start: "09:00", end: "17:00" },
};

const expected = computeSlaDeadlines({
  createdAt,
  timeZone: "America/Los_Angeles",
  businessHours,
  firstResponseMinutes: SLA_FIRST_RESPONSE_MINUTES,
  resolutionMinutes: SLA_RESOLUTION_MINUTES,
});

if (SLA_FIRST_RESPONSE_MINUTES !== 8 * 60 || SLA_RESOLUTION_MINUTES !== 5 * 8 * 60) {
  process.exit(1);
}

const actualFirst = new Date(ticket.sla.firstResponseDueAt).toISOString();
const actualResolution = new Date(ticket.sla.resolutionDueAt).toISOString();

if (actualFirst !== expected.firstResponseDueAt.toISOString()) {
  process.exit(1);
}
if (actualResolution !== expected.resolutionDueAt.toISOString()) {
  process.exit(1);
}
' /tmp/ticket_sla_get.json "$fixed_now"
