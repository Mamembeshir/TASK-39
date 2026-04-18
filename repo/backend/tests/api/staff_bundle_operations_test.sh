#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"

# Login as admin (admin can manage bundles)
login_code=$(curl -sS -o /tmp/staff_bundle_login.json -w "%{http_code}" \
  -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: staff-bundle-device" \
  -d '{"username":"admin_demo","password":"devpass123456"}')

if [ "$login_code" != "200" ]; then exit 1; fi

staff_token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.accessToken)process.exit(1);process.stdout.write(p.accessToken);' /tmp/staff_bundle_login.json)

suffix=$(date +%s)

# POST /api/staff/bundles — create bundle
bundle_payload=$(cat <<EOF
{
  "title":"Operations Bundle $suffix",
  "description":"Bundle for ops coverage test",
  "published":false,
  "components":[
    {"serviceId":"65f000000000000000000101","spec":{"durationMinutes":60,"headcount":1,"toolsMode":"provider","addOnIds":[]}},
    {"serviceId":"65f000000000000000000102","spec":{"durationMinutes":30,"headcount":1,"toolsMode":"provider","addOnIds":[]}}
  ]
}
EOF
)

create_code=$(curl -sS -o /tmp/staff_bundle_create.json -w "%{http_code}" \
  -X POST "$base_url/api/staff/bundles" \
  -H "Authorization: Bearer $staff_token" \
  -H "Content-Type: application/json" \
  -d "$bundle_payload")

if [ "$create_code" != "201" ]; then exit 1; fi

bundle_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.id)process.exit(1);process.stdout.write(p.id);' /tmp/staff_bundle_create.json)

# PATCH /api/staff/bundles/:id — update description
patch_code=$(curl -sS -o /tmp/staff_bundle_patch.json -w "%{http_code}" \
  -X PATCH "$base_url/api/staff/bundles/$bundle_id" \
  -H "Authorization: Bearer $staff_token" \
  -H "Content-Type: application/json" \
  -d '{"description":"Updated bundle description via PATCH"}')

if [ "$patch_code" != "200" ]; then exit 1; fi

# POST /api/staff/bundles/:id/publish
publish_code=$(curl -sS -o /tmp/staff_bundle_publish.json -w "%{http_code}" \
  -X POST "$base_url/api/staff/bundles/$bundle_id/publish" \
  -H "Authorization: Bearer $staff_token")

if [ "$publish_code" != "200" ]; then exit 1; fi

# POST /api/staff/bundles/:id/unpublish
unpublish_code=$(curl -sS -o /tmp/staff_bundle_unpublish.json -w "%{http_code}" \
  -X POST "$base_url/api/staff/bundles/$bundle_id/unpublish" \
  -H "Authorization: Bearer $staff_token")

if [ "$unpublish_code" != "200" ]; then exit 1; fi

node -e '
const fs=require("fs");
const payload=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
process.exit(payload ? 0 : 1);
' /tmp/staff_bundle_unpublish.json
