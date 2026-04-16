#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"

login_code=$(curl -sS -o /tmp/auth_wrong_role_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: wrong-role-device" \
  -d '{"username":"customer_demo","password":"devpass123456"}')

if [ "$login_code" != "200" ]; then
  exit 1
fi

token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.accessToken);' /tmp/auth_wrong_role_login.json)

payload='{
  "title":"role check",
  "description":"customer should be forbidden",
  "category":"test",
  "tags":["role"],
  "published":false,
  "specDefinitions":{"durationMinutes":[30],"headcount":[1],"toolsMode":["provider"]},
  "addOns":[],
  "bundleIds":[]
}'

code=$(curl -sS -o /tmp/auth_wrong_role.json -w "%{http_code}" -X POST "$base_url/api/staff/services" \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d "$payload")

if [ "$code" != "403" ]; then
  exit 1
fi

node -e '
const fs=require("fs");
const payload=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
process.exit(payload && payload.code === "FORBIDDEN" ? 0 : 1);
' /tmp/auth_wrong_role.json
