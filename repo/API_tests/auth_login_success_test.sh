#!/bin/sh

response_file="/tmp/auth_login_success.json"
base_url="${API_BASE_URL:-http://api:4000}"

http_code=$(curl -sS -o "$response_file" -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: test-device-a" \
  -d '{"username":"customer_demo","password":"devpass123456"}')

if [ "$http_code" != "200" ]; then
  exit 1
fi

node -e '
const fs = require("fs");
const payload = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const ok = Boolean(
  payload &&
    payload.accessToken &&
    payload.refreshToken &&
    payload.user &&
    payload.user.username === "customer_demo"
);
process.exit(ok ? 0 : 1);
' "$response_file"
