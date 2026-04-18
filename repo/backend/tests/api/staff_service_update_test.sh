#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"

login_code=$(curl -sS -o /tmp/staff_svc_update_login.json -w "%{http_code}" \
  -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: staff-svc-update-device" \
  -d '{"username":"manager_demo","password":"devpass123456"}')

if [ "$login_code" != "200" ]; then exit 1; fi

staff_token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.accessToken)process.exit(1);process.stdout.write(p.accessToken);' /tmp/staff_svc_update_login.json)

suffix=$(date +%s)

# Create a service to patch
create_payload=$(cat <<EOF
{
  "title":"Update Flow Service $suffix",
  "description":"Initial description",
  "category":"update_flow",
  "tags":["update"],
  "published":false,
  "specDefinitions":{"durationMinutes":[30,60],"headcount":[1],"toolsMode":["provider"]},
  "addOns":[],
  "bundleIds":[]
}
EOF
)

create_code=$(curl -sS -o /tmp/staff_svc_update_create.json -w "%{http_code}" \
  -X POST "$base_url/api/staff/services" \
  -H "Authorization: Bearer $staff_token" \
  -H "Content-Type: application/json" \
  -d "$create_payload")

if [ "$create_code" != "201" ]; then exit 1; fi

service_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.id)process.exit(1);process.stdout.write(p.id);' /tmp/staff_svc_update_create.json)

# PATCH /api/staff/services/:id — update the description
patch_code=$(curl -sS -o /tmp/staff_svc_update_result.json -w "%{http_code}" \
  -X PATCH "$base_url/api/staff/services/$service_id" \
  -H "Authorization: Bearer $staff_token" \
  -H "Content-Type: application/json" \
  -d '{"description":"Updated description via PATCH test"}')

if [ "$patch_code" != "200" ]; then exit 1; fi

node -e '
const fs=require("fs");
const payload=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
// PATCH returns { status: "ok" }
process.exit(payload && payload.status === "ok" ? 0 : 1);
' /tmp/staff_svc_update_result.json
