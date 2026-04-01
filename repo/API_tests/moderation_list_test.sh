#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"

mod_login=$(curl -sS -o /tmp/mod_list_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: moderation-list-mod" \
  -d '{"username":"moderator_demo","password":"devpass123456"}')

if [ "$mod_login" != "200" ]; then exit 1; fi

mod_token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.accessToken);' /tmp/mod_list_login.json)

customer_login=$(curl -sS -o /tmp/mod_list_customer_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: moderation-list-customer" \
  -d '{"username":"customer_demo","password":"devpass123456"}')

if [ "$customer_login" != "200" ]; then exit 1; fi

customer_token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.accessToken);' /tmp/mod_list_customer_login.json)

mod_code=$(curl -sS -o /tmp/mod_list_mod.json -w "%{http_code}" "$base_url/api/moderation/reviews" \
  -H "Authorization: Bearer $mod_token")

if [ "$mod_code" != "200" ]; then exit 1; fi

customer_code=$(curl -sS -o /tmp/mod_list_customer.json -w "%{http_code}" "$base_url/api/moderation/reviews" \
  -H "Authorization: Bearer $customer_token")

if [ "$customer_code" != "403" ]; then exit 1; fi

node -e '
const fs=require("fs");
const payload=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
if (!Array.isArray(payload)) process.exit(1);
if (payload.length > 0 && !payload.every((item) => item.status === "quarantined")) process.exit(1);
' /tmp/mod_list_mod.json
