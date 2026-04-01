#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"

login_code=$(curl -sS -o /tmp/compare_limit_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: compare-limit-device" \
  -d '{"username":"customer_demo","password":"devpass123456"}')

if [ "$login_code" != "200" ]; then
  exit 1
fi

token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.accessToken) process.exit(1);process.stdout.write(p.accessToken);' /tmp/compare_limit_login.json)

payload='{"serviceIds":["65f000000000000000000101","65f000000000000000000102","65f000000000000000000103","65f000000000000000000104","65f000000000000000000201","65f000000000000000000202"]}'

put_code=$(curl -sS -o /tmp/compare_limit_response.json -w "%{http_code}" -X PUT "$base_url/api/compare" \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d "$payload")

if [ "$put_code" != "400" ]; then
  exit 1
fi

node -e '
const fs=require("fs");
const payload=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
process.exit(payload && payload.code === "COMPARE_LIMIT_EXCEEDED" ? 0 : 1);
' /tmp/compare_limit_response.json
