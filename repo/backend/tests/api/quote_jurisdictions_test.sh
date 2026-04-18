#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"

login_code=$(curl -sS -o /tmp/quote_jurisdictions_login.json -w "%{http_code}" \
  -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: quote-jurisdictions-device" \
  -d '{"username":"customer_demo","password":"devpass123456"}')

if [ "$login_code" != "200" ]; then exit 1; fi

token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.accessToken)process.exit(1);process.stdout.write(p.accessToken);' /tmp/quote_jurisdictions_login.json)

# GET /api/quote/jurisdictions returns the list of available tax jurisdictions
http_code=$(curl -sS -o /tmp/quote_jurisdictions_result.json -w "%{http_code}" \
  "$base_url/api/quote/jurisdictions" \
  -H "Authorization: Bearer $token")

if [ "$http_code" != "200" ]; then exit 1; fi

node -e '
const fs=require("fs");
const payload=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
// Response shape: { jurisdictions: [...] }
process.exit(Array.isArray(payload.jurisdictions) ? 0 : 1);
' /tmp/quote_jurisdictions_result.json
