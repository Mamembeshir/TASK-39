#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"

admin_login_code=$(curl -sS -o /tmp/bundle_quote_admin_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: bundle-quote-admin-device" \
  -d '{"username":"admin_demo","password":"devpass123456"}')

customer_login_code=$(curl -sS -o /tmp/bundle_quote_customer_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: bundle-quote-customer-device" \
  -d '{"username":"customer_demo","password":"devpass123456"}')

if [ "$admin_login_code" != "200" ] || [ "$customer_login_code" != "200" ]; then
  exit 1
fi

admin_token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.accessToken)process.exit(1);process.stdout.write(p.accessToken);' /tmp/bundle_quote_admin_login.json)
customer_token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.accessToken)process.exit(1);process.stdout.write(p.accessToken);' /tmp/bundle_quote_customer_login.json)

bundle_payload='{
  "title":"Hardened Bundle",
  "description":"Bundle with default component specs",
  "published":true,
  "components":[
    {"serviceId":"65f000000000000000000101","spec":{"durationMinutes":60,"headcount":1,"toolsMode":"provider","addOnIds":[]}},
    {"serviceId":"65f000000000000000000102","spec":{"durationMinutes":30,"headcount":1,"toolsMode":"provider","addOnIds":[]}}
  ]
}'

bundle_code=$(curl -sS -o /tmp/bundle_quote_bundle.json -w "%{http_code}" -X POST "$base_url/api/staff/bundles" \
  -H "Authorization: Bearer $admin_token" \
  -H "Content-Type: application/json" \
  -d "$bundle_payload")

if [ "$bundle_code" != "201" ]; then
  exit 1
fi

bundle_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.id)process.exit(1);process.stdout.write(p.id);' /tmp/bundle_quote_bundle.json)
booking_requested_at=$(node -e 'process.stdout.write(new Date().toISOString())')

quote_payload=$(cat <<EOF
{
  "lineItems":[{"type":"bundle","bundleId":"$bundle_id","quantity":1}],
  "slotStart":"2026-04-10T18:00:00.000Z",
  "bookingRequestedAt":"$booking_requested_at",
  "milesFromDepot":5,
  "jurisdictionId":"US-OR-PDX"
}
EOF
)

quote_code=$(curl -sS -o /tmp/bundle_quote_response.json -w "%{http_code}" -X POST "$base_url/api/quote" \
  -H "Authorization: Bearer $customer_token" \
  -H "Content-Type: application/json" \
  -d "$quote_payload")

if [ "$quote_code" != "200" ]; then
  exit 1
fi

node -e '
const fs=require("fs");
const payload=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const line=(payload.itemizedLines||[])[0];
const ok = line
  && line.type === "bundle"
  && line.durationMinutes === 90
  && Array.isArray(line.breakdown?.components)
  && line.breakdown.components.length === 2
  && payload.quoteSignature;
process.exit(ok ? 0 : 1);
' /tmp/bundle_quote_response.json
