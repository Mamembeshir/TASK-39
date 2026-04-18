#!/bin/sh

response_file="/tmp/auth_refresh_login.json"
cookie_file="/tmp/auth_refresh.cookies"
base_url="${API_BASE_URL:-http://api:4000}"

# Login to get tokens (AUTH_RESPONSE_INCLUDE_TOKENS=true in test env includes tokens in body)
login_code=$(curl -sS -c "$cookie_file" -o "$response_file" -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: test-device-refresh" \
  -d '{"username":"customer_demo","password":"devpass123456"}')

if [ "$login_code" != "200" ]; then
  exit 1
fi

# Extract refresh token from body (AUTH_RESPONSE_INCLUDE_TOKENS=true exposes it for tests)
refresh_token=$(node -e '
const fs=require("fs");
const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
if(!p.refreshToken)process.exit(1);
process.stdout.write(p.refreshToken);
' "$response_file")

# POST /api/auth/refresh with refreshToken in body
refresh_code=$(curl -sS -b "$cookie_file" -o /tmp/auth_refresh_result.json -w "%{http_code}" \
  -X POST "$base_url/api/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$refresh_token\"}")

if [ "$refresh_code" != "200" ]; then
  exit 1
fi

# Verify new access token is returned
node -e '
const fs=require("fs");
const payload=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const ok=Boolean(payload && payload.accessToken);
process.exit(ok?0:1);
' /tmp/auth_refresh_result.json
