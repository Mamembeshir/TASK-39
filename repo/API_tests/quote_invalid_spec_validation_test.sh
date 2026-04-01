#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"

login_code=$(curl -sS -o /tmp/quote_invalid_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: quote-invalid-spec-device" \
  -d '{"username":"customer_demo","password":"devpass123456"}')

if [ "$login_code" != "200" ]; then
  exit 1
fi

token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.accessToken);' /tmp/quote_invalid_login.json)

headcount_code=$(curl -sS -o /tmp/quote_invalid_headcount.json -w "%{http_code}" -X POST "$base_url/api/quote" \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d '{"lineItems":[{"type":"service","serviceId":"65f000000000000000000102","durationMinutes":30,"quantity":1,"spec":{"headcount":4}}],"slotStart":"2026-04-10T18:00:00.000Z","bookingRequestedAt":"2026-04-10T12:00:00.000Z","milesFromDepot":5,"jurisdictionId":"US-OR-PDX"}')

tools_code=$(curl -sS -o /tmp/quote_invalid_tools.json -w "%{http_code}" -X POST "$base_url/api/quote" \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d '{"lineItems":[{"type":"service","serviceId":"65f000000000000000000101","durationMinutes":30,"quantity":1,"spec":{"toolsMode":"warehouse"}}],"slotStart":"2026-04-10T18:00:00.000Z","bookingRequestedAt":"2026-04-10T12:00:00.000Z","milesFromDepot":5,"jurisdictionId":"US-OR-PDX"}')

addon_code=$(curl -sS -o /tmp/quote_invalid_addon.json -w "%{http_code}" -X POST "$base_url/api/quote" \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d '{"lineItems":[{"type":"service","serviceId":"65f000000000000000000101","durationMinutes":30,"quantity":1,"spec":{"addOnIds":["unknown_addon"]}}],"slotStart":"2026-04-10T18:00:00.000Z","bookingRequestedAt":"2026-04-10T12:00:00.000Z","milesFromDepot":5,"jurisdictionId":"US-OR-PDX"}')

if [ "$headcount_code" != "400" ] || [ "$tools_code" != "400" ] || [ "$addon_code" != "400" ]; then
  exit 1
fi

node -e '
const fs=require("fs");
const headcount=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const tools=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
const addon=JSON.parse(fs.readFileSync(process.argv[3],"utf8"));
const ok = headcount.code === "INVALID_HEADCOUNT"
  && tools.code === "INVALID_TOOLS_MODE"
  && addon.code === "INVALID_ADD_ON";
process.exit(ok ? 0 : 1);
' /tmp/quote_invalid_headcount.json /tmp/quote_invalid_tools.json /tmp/quote_invalid_addon.json
