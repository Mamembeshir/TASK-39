#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"

login_code=$(curl -sS -o /tmp/search_admin_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: search-admin-device" \
  -d '{"username":"admin_demo","password":"devpass123456"}')

if [ "$login_code" != "200" ]; then
  exit 1
fi

token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.accessToken)process.exit(1);process.stdout.write(p.accessToken);' /tmp/search_admin_login.json)
term="searchterm$(date +%s)"

unpublished_payload=$(cat <<EOF
{
  "title":"$term hidden service",
  "description":"unpublished service",
  "category":"search_test",
  "tags":["$term"],
  "published":false,
  "specDefinitions":{"durationMinutes":[30],"headcount":[1],"toolsMode":["provider"]},
  "addOns":[],
  "bundleIds":[]
}
EOF
)

published_payload=$(cat <<EOF
{
  "title":"$term visible service",
  "description":"published service",
  "category":"search_test",
  "tags":["$term"],
  "published":true,
  "specDefinitions":{"durationMinutes":[30],"headcount":[1],"toolsMode":["provider"]},
  "addOns":[],
  "bundleIds":[]
}
EOF
)

draft_content_payload=$(cat <<EOF
{"slug":"$term-draft","title":"$term draft content","body":"should not be searchable","mediaIds":[]}
EOF
)

published_content_payload=$(cat <<EOF
{"slug":"$term-pub","title":"$term published content","body":"should be searchable","mediaIds":[]}
EOF
)

unpub_code=$(curl -sS -o /tmp/search_unpub_service.json -w "%{http_code}" -X POST "$base_url/api/staff/services" \
  -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d "$unpublished_payload")
pub_code=$(curl -sS -o /tmp/search_pub_service.json -w "%{http_code}" -X POST "$base_url/api/staff/services" \
  -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d "$published_payload")

if [ "$unpub_code" != "201" ] || [ "$pub_code" != "201" ]; then
  exit 1
fi

unpub_service_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.id);' /tmp/search_unpub_service.json)
pub_service_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.id);' /tmp/search_pub_service.json)

draft_content_code=$(curl -sS -o /tmp/search_draft_content.json -w "%{http_code}" -X POST "$base_url/api/content" \
  -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d "$draft_content_payload")
pub_content_code=$(curl -sS -o /tmp/search_pub_content.json -w "%{http_code}" -X POST "$base_url/api/content" \
  -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d "$published_content_payload")

if [ "$draft_content_code" != "201" ] || [ "$pub_content_code" != "201" ]; then
  exit 1
fi

pub_content_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.id);' /tmp/search_pub_content.json)
pub_content_version_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.versionId);' /tmp/search_pub_content.json)

publish_content_code=$(curl -sS -o /tmp/search_pub_content_publish.json -w "%{http_code}" -X POST "$base_url/api/content/$pub_content_id/publish" \
  -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d "{\"versionId\":\"$pub_content_version_id\"}")

if [ "$publish_content_code" != "200" ]; then
  exit 1
fi

search_code=$(curl -sS -o /tmp/search_results.json -w "%{http_code}" "$base_url/api/search?q=$term")
if [ "$search_code" != "200" ]; then
  exit 1
fi

node -e '
const fs=require("fs");
const payload=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const unpub=process.argv[2];
const pub=process.argv[3];
const contentId=process.argv[4];
const results=payload.results||[];
const hasUnpub=results.some((r)=>r.type==="service"&&r.id===unpub);
const hasPub=results.some((r)=>r.type==="service"&&r.id===pub);
const hasContent=results.some((r)=>r.type==="content"&&r.id===contentId);
process.exit(!hasUnpub && hasPub && hasContent ? 0 : 1);
' /tmp/search_results.json "$unpub_service_id" "$pub_service_id" "$pub_content_id"
