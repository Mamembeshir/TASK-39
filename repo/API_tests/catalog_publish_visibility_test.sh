#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"

login_code=$(curl -sS -o /tmp/catalog_publish_staff_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: catalog-staff-b" \
  -d '{"username":"manager_demo","password":"devpass123456"}')

if [ "$login_code" != "200" ]; then
  exit 1
fi

staff_token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.accessToken)process.exit(1);process.stdout.write(p.accessToken);' /tmp/catalog_publish_staff_login.json)

suffix=$(date +%s)
payload=$(cat <<EOF
{
  "title": "Publish Flow Service $suffix",
  "description": "Created unpublished then published",
  "category": "publish_flow",
  "tags": ["publish", "flow"],
  "published": false,
  "specDefinitions": {
    "durationMinutes": [30, 90],
    "headcount": [1, 3],
    "toolsMode": ["provider"]
  },
  "addOns": ["flow_addon"],
  "bundleIds": []
}
EOF
)

create_code=$(curl -sS -o /tmp/catalog_publish_create.json -w "%{http_code}" -X POST "$base_url/api/staff/services" \
  -H "Authorization: Bearer $staff_token" \
  -H "Content-Type: application/json" \
  -d "$payload")

if [ "$create_code" != "201" ]; then
  exit 1
fi

service_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.id)process.exit(1);process.stdout.write(p.id);' /tmp/catalog_publish_create.json)

publish_code=$(curl -sS -o /tmp/catalog_publish_result.json -w "%{http_code}" -X POST "$base_url/api/staff/services/$service_id/publish" \
  -H "Authorization: Bearer $staff_token")

if [ "$publish_code" != "200" ]; then
  exit 1
fi

public_list_code=$(curl -sS -o /tmp/catalog_publish_public_list.json -w "%{http_code}" "$base_url/api/services?category=publish_flow")

if [ "$public_list_code" != "200" ]; then
  exit 1
fi

node -e '
const fs=require("fs");
const list=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const id=process.argv[2];
const found=(list.services||[]).some((service)=>service.id===id && service.published===true);
process.exit(found?0:1);
' /tmp/catalog_publish_public_list.json "$service_id"
