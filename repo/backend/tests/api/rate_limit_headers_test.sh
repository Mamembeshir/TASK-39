#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"

health_headers=/tmp/rate_limit_health_headers.txt
auth_headers=/tmp/rate_limit_auth_headers.txt

health_code=$(curl -sS -D "$health_headers" -o /tmp/rate_limit_health.json -w "%{http_code}" "$base_url/api/health")
auth_code=$(curl -sS -D "$auth_headers" -o /tmp/rate_limit_auth.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: rate-limit-headers-device" \
  -d '{"username":"customer_demo","password":"devpass123456"}')

if [ "$health_code" != "200" ] || [ "$auth_code" != "200" ]; then
  exit 1
fi

node -e '
const fs=require("fs");
function parseHeaders(file) {
  return fs.readFileSync(file,"utf8").toLowerCase();
}
const publicHeaders=parseHeaders(process.argv[1]);
const authHeaders=parseHeaders(process.argv[2]);
const required=["x-ratelimit-limit:","x-ratelimit-remaining:","x-ratelimit-reset:"];
const ok = required.every((header) => publicHeaders.includes(header) && authHeaders.includes(header));
process.exit(ok ? 0 : 1);
' "$health_headers" "$auth_headers"
