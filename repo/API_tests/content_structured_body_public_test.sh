#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"

login_code=$(curl -sS -o /tmp/content_structured_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: content-structured-device" \
  -d '{"username":"admin_demo","password":"devpass123456"}')

if [ "$login_code" != "200" ]; then exit 1; fi

token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.accessToken);' /tmp/content_structured_login.json)
slug="structured-public-$(date +%s)"

create_payload=$(cat <<EOF
{"slug":"$slug","title":"Structured article","body":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Structured body"}]}]},"mediaIds":[]}
EOF
)

create_code=$(curl -sS -o /tmp/content_structured_create.json -w "%{http_code}" -X POST "$base_url/api/content" \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d "$create_payload")

if [ "$create_code" != "201" ]; then exit 1; fi

content_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.id);' /tmp/content_structured_create.json)
version_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.versionId);' /tmp/content_structured_create.json)

publish_code=$(curl -sS -o /tmp/content_structured_publish.json -w "%{http_code}" -X POST "$base_url/api/content/$content_id/publish" \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d "{\"versionId\":\"$version_id\"}")

if [ "$publish_code" != "200" ]; then exit 1; fi

read_code=$(curl -sS -o /tmp/content_structured_read.json -w "%{http_code}" "$base_url/api/content/$content_id")

if [ "$read_code" != "200" ]; then exit 1; fi

node -e '
const fs=require("fs");
const payload=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
if (!payload || typeof payload.body !== "string") process.exit(1);
const parsed=JSON.parse(payload.body);
const ok = parsed.type === "doc"
  && Array.isArray(parsed.content)
  && parsed.content[0]?.content?.[0]?.text === "Structured body";
process.exit(ok ? 0 : 1);
' /tmp/content_structured_read.json
