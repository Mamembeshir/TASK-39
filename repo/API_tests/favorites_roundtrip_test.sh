#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"
service_id="65f000000000000000000101"

login_code=$(curl -sS -o /tmp/favorites_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: favorites-device" \
  -d '{"username":"customer_demo","password":"devpass123456"}')

if [ "$login_code" != "200" ]; then
  exit 1
fi

token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.accessToken) process.exit(1);process.stdout.write(p.accessToken);' /tmp/favorites_login.json)

add_code=$(curl -sS -o /tmp/favorites_add.json -w "%{http_code}" -X POST "$base_url/api/favorites/$service_id" \
  -H "Authorization: Bearer $token")
if [ "$add_code" != "200" ]; then
  exit 1
fi

get_code=$(curl -sS -o /tmp/favorites_get.json -w "%{http_code}" "$base_url/api/favorites" \
  -H "Authorization: Bearer $token")
if [ "$get_code" != "200" ]; then
  exit 1
fi

node -e '
const fs=require("fs");
const payload=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const id=process.argv[2];
const found=(payload.favorites||[]).some((item)=>item.id===id);
process.exit(found?0:1);
' /tmp/favorites_get.json "$service_id"

delete_code=$(curl -sS -o /tmp/favorites_delete.json -w "%{http_code}" -X DELETE "$base_url/api/favorites/$service_id" \
  -H "Authorization: Bearer $token")
if [ "$delete_code" != "200" ]; then
  exit 1
fi
