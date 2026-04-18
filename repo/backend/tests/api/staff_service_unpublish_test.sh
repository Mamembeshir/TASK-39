#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"

login_code=$(curl -sS -o /tmp/staff_svc_unpub_login.json -w "%{http_code}" \
  -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: staff-svc-unpub-device" \
  -d '{"username":"manager_demo","password":"devpass123456"}')

if [ "$login_code" != "200" ]; then exit 1; fi

staff_token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.accessToken)process.exit(1);process.stdout.write(p.accessToken);' /tmp/staff_svc_unpub_login.json)

suffix=$(date +%s)

create_payload=$(cat <<EOF
{
  "title":"Unpublish Flow $suffix",
  "description":"Will be published then unpublished",
  "category":"unpublish_flow_$suffix",
  "tags":["unpublish"],
  "published":false,
  "specDefinitions":{"durationMinutes":[30],"headcount":[1],"toolsMode":["provider"]},
  "addOns":[],
  "bundleIds":[]
}
EOF
)

create_code=$(curl -sS -o /tmp/staff_svc_unpub_create.json -w "%{http_code}" \
  -X POST "$base_url/api/staff/services" \
  -H "Authorization: Bearer $staff_token" \
  -H "Content-Type: application/json" \
  -d "$create_payload")

if [ "$create_code" != "201" ]; then exit 1; fi

service_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.id)process.exit(1);process.stdout.write(p.id);' /tmp/staff_svc_unpub_create.json)

# Publish first
publish_code=$(curl -sS -o /tmp/staff_svc_unpub_publish.json -w "%{http_code}" \
  -X POST "$base_url/api/staff/services/$service_id/publish" \
  -H "Authorization: Bearer $staff_token")

if [ "$publish_code" != "200" ]; then exit 1; fi

# POST /api/staff/services/:id/unpublish
unpublish_code=$(curl -sS -o /tmp/staff_svc_unpub_result.json -w "%{http_code}" \
  -X POST "$base_url/api/staff/services/$service_id/unpublish" \
  -H "Authorization: Bearer $staff_token")

if [ "$unpublish_code" != "200" ]; then exit 1; fi

# Verify the service is no longer visible in the public catalog
public_code=$(curl -sS -o /tmp/staff_svc_unpub_public.json -w "%{http_code}" \
  "$base_url/api/services/$service_id")

if [ "$public_code" != "200" ] && [ "$public_code" != "404" ]; then exit 1; fi

node -e '
const fs=require("fs");
const payload=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
// Either 404 or a service with published=false confirms unpublish succeeded
const ok = !payload || payload.id === undefined || payload.published === false;
process.exit(ok ? 0 : 1);
' /tmp/staff_svc_unpub_public.json
