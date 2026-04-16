#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"

login_code=$(curl -sS -o /tmp/catalog_filter_staff_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: catalog-filter-staff-device" \
  -d '{"username":"manager_demo","password":"devpass123456"}')

if [ "$login_code" != "200" ]; then
  exit 1
fi

staff_token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.accessToken);' /tmp/catalog_filter_staff_login.json)
suffix=$(date +%s)
payload=$(cat <<EOF
{
  "title": "Filterable Service $suffix",
  "description": "Created for catalog filter verification",
  "category": "filter_test",
  "tags": ["alpha_filter", "beta_filter"],
  "published": true,
  "specDefinitions": {
    "durationMinutes": [30, 60],
    "headcount": [1, 2],
    "toolsMode": ["provider", "customer"]
  },
  "addOns": ["filter_addon"],
  "bundleIds": []
}
EOF
)

create_code=$(curl -sS -o /tmp/catalog_filter_create.json -w "%{http_code}" -X POST "$base_url/api/staff/services" \
  -H "Authorization: Bearer $staff_token" \
  -H "Content-Type: application/json" \
  -d "$payload")

if [ "$create_code" != "201" ]; then
  exit 1
fi

service_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.id);' /tmp/catalog_filter_create.json)

filter_code=$(curl -sS -o /tmp/catalog_filter_response.json -w "%{http_code}" "$base_url/api/services?category=filter_test&tags=alpha_filter,beta_filter")
miss_code=$(curl -sS -o /tmp/catalog_filter_miss.json -w "%{http_code}" "$base_url/api/services?category=filter_test&tags=alpha_filter,missing_tag")

if [ "$filter_code" != "200" ] || [ "$miss_code" != "200" ]; then
  exit 1
fi

node -e '
const fs=require("fs");
const filtered=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const missed=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
const id=process.argv[3];
const found=(filtered.services||[]).some((service)=>service.id===id && service.category==="filter_test");
const missing=(missed.services||[]).some((service)=>service.id===id);
process.exit(found && !missing ? 0 : 1);
' /tmp/catalog_filter_response.json /tmp/catalog_filter_miss.json "$service_id"
