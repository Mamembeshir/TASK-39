#!/bin/sh

response_file="/tmp/seed_check_response.json"
base_url="${API_BASE_URL:-http://api:4000}"
internal_token="${INTERNAL_ROUTES_TOKEN:-dev-internal-token}"
internal_admin_token="${INTERNAL_ADMIN_TOKEN:-}"
http_code=$(curl -sS -o "$response_file" -w "%{http_code}" "$base_url/api/internal/seed-check" \
  -H "X-Internal-Token: $internal_token" \
  -H "Authorization: Bearer $internal_admin_token")

if [ "$http_code" != "200" ]; then
  exit 1
fi

node -e '
const fs = require("fs");
const payload = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const ok =
  payload &&
  payload.customerUser &&
  payload.customerUser.username === "customer_demo" &&
  payload.counts &&
  payload.counts.users >= 4 &&
  payload.counts.services >= 3 &&
  payload.counts.capacity_slots >= 7;
process.exit(ok ? 0 : 1);
' "$response_file"
