#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"

admin_login_code=$(curl -sS -o /tmp/inbox_visibility_admin_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: inbox-visibility-admin-device" \
  -d '{"username":"admin_demo","password":"devpass123456"}')

customer_login_code=$(curl -sS -o /tmp/inbox_visibility_customer_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: inbox-visibility-customer-device" \
  -d '{"username":"customer_demo","password":"devpass123456"}')

if [ "$admin_login_code" != "200" ] || [ "$customer_login_code" != "200" ]; then
  exit 1
fi

admin_token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.accessToken)process.exit(1);process.stdout.write(p.accessToken);' /tmp/inbox_visibility_admin_login.json)
customer_token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.accessToken)process.exit(1);process.stdout.write(p.accessToken);' /tmp/inbox_visibility_customer_login.json)

suffix=$(date +%s)
create_payload=$(cat <<EOF
{"title":"Moderator only $suffix","body":"restricted","roles":["moderator"]}
EOF
)

create_code=$(curl -sS -o /tmp/inbox_visibility_create.json -w "%{http_code}" -X POST "$base_url/api/staff/messages" \
  -H "Authorization: Bearer $admin_token" \
  -H "Content-Type: application/json" \
  -d "$create_payload")

if [ "$create_code" != "201" ]; then
  exit 1
fi

message_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.id)process.exit(1);process.stdout.write(p.id);' /tmp/inbox_visibility_create.json)

inbox_code=$(curl -sS -o /tmp/inbox_visibility_customer_inbox.json -w "%{http_code}" "$base_url/api/inbox" \
  -H "Authorization: Bearer $customer_token")

if [ "$inbox_code" != "200" ]; then
  exit 1
fi

node -e '
const fs=require("fs");
const payload=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const id=process.argv[2];
const found=(payload.messages||[]).some((m)=>m.id===id);
process.exit(found ? 1 : 0);
' /tmp/inbox_visibility_customer_inbox.json "$message_id"
