#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"
service_id="65f000000000000000000101"

login_code=$(curl -sS -o /tmp/quote_slots_login.json -w "%{http_code}" \
  -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: quote-slots-device" \
  -d '{"username":"customer_demo","password":"devpass123456"}')

if [ "$login_code" != "200" ]; then exit 1; fi

token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.accessToken)process.exit(1);process.stdout.write(p.accessToken);' /tmp/quote_slots_login.json)

# GET /api/quote/slots?serviceId=<id> returns available capacity slots for a service
http_code=$(curl -sS -o /tmp/quote_slots_result.json -w "%{http_code}" \
  "$base_url/api/quote/slots?serviceId=$service_id" \
  -H "Authorization: Bearer $token")

if [ "$http_code" != "200" ]; then exit 1; fi

node -e '
const fs=require("fs");
const payload=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
// Response shape: { slots: [...] }
process.exit(Array.isArray(payload.slots) ? 0 : 1);
' /tmp/quote_slots_result.json
