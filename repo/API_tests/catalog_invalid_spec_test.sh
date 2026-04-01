#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"

login_code=$(curl -sS -o /tmp/catalog_invalid_staff_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: catalog-staff-c" \
  -d '{"username":"admin_demo","password":"devpass123456"}')

if [ "$login_code" != "200" ]; then
  exit 1
fi

staff_token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.accessToken)process.exit(1);process.stdout.write(p.accessToken);' /tmp/catalog_invalid_staff_login.json)

invalid_payload='{
  "title": "Invalid Spec Service",
  "description": "Should fail validation",
  "category": "invalid",
  "tags": ["invalid"],
  "published": false,
  "specDefinitions": {
    "durationMinutes": [45],
    "headcount": [0, 5],
    "toolsMode": ["invalid_mode"]
  },
  "addOns": ["addon"],
  "bundleIds": []
}'

create_code=$(curl -sS -o /tmp/catalog_invalid_spec_response.json -w "%{http_code}" -X POST "$base_url/api/staff/services" \
  -H "Authorization: Bearer $staff_token" \
  -H "Content-Type: application/json" \
  -d "$invalid_payload")

if [ "$create_code" != "400" ]; then
  exit 1
fi

node -e '
const fs=require("fs");
const payload=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
process.exit(payload && payload.code === "INVALID_SPEC" ? 0 : 1);
' /tmp/catalog_invalid_spec_response.json
