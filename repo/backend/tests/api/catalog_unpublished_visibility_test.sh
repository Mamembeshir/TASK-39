#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"

login_code=$(curl -sS -o /tmp/catalog_staff_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: catalog-staff-a" \
  -d '{"username":"manager_demo","password":"devpass123456"}')

if [ "$login_code" != "200" ]; then
  exit 1
fi

staff_token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.accessToken)process.exit(1);process.stdout.write(p.accessToken);' /tmp/catalog_staff_login.json)

suffix=$(date +%s)
payload=$(cat <<EOF
{
  "title": "Unpublished Catalog Service $suffix",
  "description": "Hidden until published",
  "category": "test_catalog",
  "tags": ["test", "hidden"],
  "published": false,
  "specDefinitions": {
    "durationMinutes": [30, 60],
    "headcount": [1, 2],
    "toolsMode": ["provider", "customer"]
  },
  "addOns": ["test_addon"],
  "bundleIds": []
}
EOF
)

create_code=$(curl -sS -o /tmp/catalog_unpublished_create.json -w "%{http_code}" -X POST "$base_url/api/staff/services" \
  -H "Authorization: Bearer $staff_token" \
  -H "Content-Type: application/json" \
  -d "$payload")

if [ "$create_code" != "201" ]; then
  exit 1
fi

service_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.id)process.exit(1);process.stdout.write(p.id);' /tmp/catalog_unpublished_create.json)

public_list_code=$(curl -sS -o /tmp/catalog_public_services.json -w "%{http_code}" "$base_url/api/services?category=test_catalog")
if [ "$public_list_code" != "200" ]; then
  exit 1
fi

node -e '
const fs=require("fs");
const list=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const id=process.argv[2];
const found=(list.services||[]).some((service)=>service.id===id);
process.exit(found?1:0);
' /tmp/catalog_public_services.json "$service_id"

public_detail_code=$(curl -sS -o /tmp/catalog_public_detail.json -w "%{http_code}" "$base_url/api/services/$service_id")
if [ "$public_detail_code" != "404" ]; then
  exit 1
fi

staff_detail_code=$(curl -sS -o /tmp/catalog_staff_detail.json -w "%{http_code}" "$base_url/api/services/$service_id" \
  -H "Authorization: Bearer $staff_token")
if [ "$staff_detail_code" != "200" ]; then
  exit 1
fi
