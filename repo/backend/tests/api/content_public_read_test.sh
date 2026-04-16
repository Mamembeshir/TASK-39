#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"

login_code=$(curl -sS -o /tmp/content_public_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: content-public-device" \
  -d '{"username":"admin_demo","password":"devpass123456"}')

if [ "$login_code" != "200" ]; then exit 1; fi

token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.accessToken);' /tmp/content_public_login.json)

draft_payload='{"slug":"content-public-draft","title":"Draft article","body":"private","mediaIds":[]}'
published_payload='{"slug":"content-public-pub","title":"Published article","body":"public body","mediaIds":[]}'

draft_code=$(curl -sS -o /tmp/content_public_draft.json -w "%{http_code}" -X POST "$base_url/api/content" -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d "$draft_payload")
pub_code=$(curl -sS -o /tmp/content_public_pub.json -w "%{http_code}" -X POST "$base_url/api/content" -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d "$published_payload")
if [ "$draft_code" != "201" ] || [ "$pub_code" != "201" ]; then exit 1; fi

pub_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.id);' /tmp/content_public_pub.json)
pub_version_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.versionId);' /tmp/content_public_pub.json)

publish_code=$(curl -sS -o /tmp/content_public_publish.json -w "%{http_code}" -X POST "$base_url/api/content/$pub_id/publish" -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d "{\"versionId\":\"$pub_version_id\"}")
if [ "$publish_code" != "200" ]; then exit 1; fi

list_code=$(curl -sS -o /tmp/content_public_list.json -w "%{http_code}" "$base_url/api/content")
if [ "$list_code" != "200" ]; then exit 1; fi

node -e '
const fs=require("fs");
const list=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
if (!Array.isArray(list)) process.exit(1);
if (!list.some((item) => item.id === process.argv[2])) process.exit(1);
if (list.some((item) => item.slug === "content-public-draft")) process.exit(1);
' /tmp/content_public_list.json "$pub_id"

public_read_code=$(curl -sS -o /tmp/content_public_read.json -w "%{http_code}" "$base_url/api/content/$pub_id")
if [ "$public_read_code" != "200" ]; then exit 1; fi

draft_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.id);' /tmp/content_public_draft.json)

draft_read_code=$(curl -sS -o /tmp/content_public_draft_read.json -w "%{http_code}" "$base_url/api/content/$draft_id")
if [ "$draft_read_code" != "404" ]; then exit 1; fi
