#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"
seed_media_id="65f000000000000000000901"

login_code=$(curl -sS -o /tmp/media_delete_blocked_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: media-delete-blocked-device" \
  -d '{"username":"admin_demo","password":"devpass123456"}')

if [ "$login_code" != "200" ]; then
  exit 1
fi

token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.accessToken) process.exit(1);process.stdout.write(p.accessToken);' /tmp/media_delete_blocked_login.json)

delete_code=$(curl -sS -o /tmp/media_delete_blocked_response.json -w "%{http_code}" -X DELETE "$base_url/api/media/$seed_media_id" \
  -H "Authorization: Bearer $token")

if [ "$delete_code" != "409" ]; then
  exit 1
fi

node -e '
const fs=require("fs");
const payload=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const ok = payload && payload.code === "MEDIA_IN_USE";
process.exit(ok ? 0 : 1);
' /tmp/media_delete_blocked_response.json
