#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"
blocked_ip="203.0.113.77"
internal_token="${INTERNAL_ROUTES_TOKEN:-dev-internal-token}"
internal_admin_token="${INTERNAL_ADMIN_TOKEN:-}"

fixture_code=$(curl -sS -o /tmp/blacklist_fixture.json -w "%{http_code}" -X POST "$base_url/api/internal/test-fixtures/blacklist-ip" \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: $internal_token" \
  -H "Authorization: Bearer $internal_admin_token" \
  -d "{\"ip\":\"$blocked_ip\"}")

if [ "$fixture_code" != "200" ]; then
  exit 1
fi

blocked_code=$(curl -sS -o /tmp/blacklist_health.json -w "%{http_code}" "$base_url/api/health" \
  -H "X-Forwarded-For: $blocked_ip")

if [ "$blocked_code" != "403" ]; then
  exit 1
fi

node -e '
const fs=require("fs");
const payload=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
process.exit(payload && payload.code === "BLACKLISTED" ? 0 : 1);
' /tmp/blacklist_health.json
