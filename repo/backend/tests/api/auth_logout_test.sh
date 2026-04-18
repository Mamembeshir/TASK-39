#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"
cookie_file="/tmp/auth_logout.cookies"

# Login to establish session cookies
login_code=$(curl -sS -c "$cookie_file" -o /tmp/auth_logout_login.json -w "%{http_code}" \
  -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: test-device-logout" \
  -d '{"username":"customer_demo","password":"devpass123456"}')

if [ "$login_code" != "200" ]; then
  exit 1
fi

# POST /api/auth/logout — cookies carry the refresh_token for revocation
logout_code=$(curl -sS -b "$cookie_file" -o /tmp/auth_logout_result.json -w "%{http_code}" \
  -X POST "$base_url/api/auth/logout")

if [ "$logout_code" != "200" ]; then
  exit 1
fi

node -e '
const fs=require("fs");
const payload=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
process.exit(payload && payload.status==="ok" ? 0 : 1);
' /tmp/auth_logout_result.json
