#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"

login_code=$(curl -sS -o /tmp/content_rollback_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: content-rollback-device" \
  -d '{"username":"admin_demo","password":"devpass123456"}')

if [ "$login_code" != "200" ]; then
  exit 1
fi

token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.accessToken) process.exit(1);process.stdout.write(p.accessToken);' /tmp/content_rollback_login.json)
slug="rollback-$(date +%s)"

create_payload=$(cat <<EOF
{"slug":"$slug","title":"v1","body":"first draft","mediaIds":[]}
EOF
)

create_code=$(curl -sS -o /tmp/content_rollback_create.json -w "%{http_code}" -X POST "$base_url/api/content" \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d "$create_payload")

if [ "$create_code" != "201" ]; then
  exit 1
fi

content_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.id)process.exit(1);process.stdout.write(p.id);' /tmp/content_rollback_create.json)
v1_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.versionId)process.exit(1);process.stdout.write(p.versionId);' /tmp/content_rollback_create.json)

draft2_payload='{"title":"v2","body":"second draft","mediaIds":[]}'
draft2_code=$(curl -sS -o /tmp/content_rollback_patch.json -w "%{http_code}" -X PATCH "$base_url/api/content/$content_id/draft" \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d "$draft2_payload")

if [ "$draft2_code" != "200" ]; then
  exit 1
fi

v2_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.currentVersionId)process.exit(1);process.stdout.write(p.currentVersionId);' /tmp/content_rollback_patch.json)

publish_code=$(curl -sS -o /tmp/content_rollback_publish.json -w "%{http_code}" -X POST "$base_url/api/content/$content_id/publish" \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d "{\"versionId\":\"$v2_id\"}")

if [ "$publish_code" != "200" ]; then
  exit 1
fi

rollback_code=$(curl -sS -o /tmp/content_rollback_result.json -w "%{http_code}" -X POST "$base_url/api/content/$content_id/rollback" \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d "{\"versionId\":\"$v1_id\"}")

if [ "$rollback_code" != "200" ]; then
  exit 1
fi

versions_code=$(curl -sS -o /tmp/content_rollback_versions.json -w "%{http_code}" "$base_url/api/content/$content_id/versions" \
  -H "Authorization: Bearer $token")

if [ "$versions_code" != "200" ]; then
  exit 1
fi

node -e '
const fs=require("fs");
const payload=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const expected=process.argv[2];
process.exit(payload && payload.publishedVersionId === expected ? 0 : 1);
' /tmp/content_rollback_versions.json "$v1_id"
