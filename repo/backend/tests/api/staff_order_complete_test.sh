#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"
internal_token="${INTERNAL_ROUTES_TOKEN:-dev-internal-token}"
internal_admin_token="${INTERNAL_ADMIN_TOKEN:-}"

# Login as staff (will complete the order)
staff_login_code=$(curl -sS -o /tmp/staff_complete_staff_login.json -w "%{http_code}" \
  -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: staff-complete-staff" \
  -d '{"username":"manager_demo","password":"devpass123456"}')

# Create a confirmed-order fixture — orders must be in "confirmed" or "in_progress"
# state before staff can mark them completed; "confirmed" is seeded directly.
fixture_code=$(curl -sS -o /tmp/staff_complete_fixture.json -w "%{http_code}" \
  -X POST "$base_url/api/internal/test-fixtures/confirmed-order" \
  -H "X-Internal-Token: $internal_token" \
  -H "Authorization: Bearer $internal_admin_token")

if [ "$staff_login_code" != "200" ] || [ "$fixture_code" != "201" ]; then
  exit 1
fi

staff_token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.accessToken);' /tmp/staff_complete_staff_login.json)
order_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.orderId)process.exit(1);process.stdout.write(p.orderId);' /tmp/staff_complete_fixture.json)

# POST /api/staff/orders/:id/complete — staff marks the confirmed order as completed
complete_code=$(curl -sS -o /tmp/staff_complete_result.json -w "%{http_code}" \
  -X POST "$base_url/api/staff/orders/$order_id/complete" \
  -H "Authorization: Bearer $staff_token")

if [ "$complete_code" != "200" ]; then exit 1; fi

node -e '
const fs=require("fs");
const payload=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
process.exit(payload && payload.status==="ok" && payload.state==="completed" ? 0 : 1);
' /tmp/staff_complete_result.json
