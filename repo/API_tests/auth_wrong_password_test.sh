#!/bin/sh

response_file="/tmp/auth_wrong_password.json"
base_url="${API_BASE_URL:-http://api:4000}"

http_code=$(curl -sS -o "$response_file" -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"customer_demo","password":"incorrect-password"}')

if [ "$http_code" != "401" ]; then
  exit 1
fi

node -e '
const fs = require("fs");
const payload = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
process.exit(payload && payload.code === "INVALID_CREDENTIALS" ? 0 : 1);
' "$response_file"
