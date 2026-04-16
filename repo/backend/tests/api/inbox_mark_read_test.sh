#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"

admin_login_code=$(curl -sS -o /tmp/inbox_read_admin_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: inbox-read-admin-device" \
  -d '{"username":"admin_demo","password":"devpass123456"}')

customer_login_code=$(curl -sS -o /tmp/inbox_read_customer_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: inbox-read-customer-device" \
  -d '{"username":"customer_demo","password":"devpass123456"}')

if [ "$admin_login_code" != "200" ] || [ "$customer_login_code" != "200" ]; then
  exit 1
fi

admin_token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.accessToken)process.exit(1);process.stdout.write(p.accessToken);' /tmp/inbox_read_admin_login.json)
customer_token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.accessToken)process.exit(1);process.stdout.write(p.accessToken);' /tmp/inbox_read_customer_login.json)

suffix=$(date +%s)
create_payload=$(cat <<EOF
{"title":"Customer message $suffix","body":"please read","roles":["customer"]}
EOF
)

create_code=$(curl -sS -o /tmp/inbox_read_create.json -w "%{http_code}" -X POST "$base_url/api/staff/messages" \
  -H "Authorization: Bearer $admin_token" \
  -H "Content-Type: application/json" \
  -d "$create_payload")

if [ "$create_code" != "201" ]; then
  exit 1
fi

message_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.id)process.exit(1);process.stdout.write(p.id);' /tmp/inbox_read_create.json)

mark_code=$(curl -sS -o /tmp/inbox_read_mark.json -w "%{http_code}" -X POST "$base_url/api/inbox/$message_id/read" \
  -H "Authorization: Bearer $customer_token")

if [ "$mark_code" != "200" ]; then
  exit 1
fi

inbox_code=$(curl -sS -o /tmp/inbox_read_inbox.json -w "%{http_code}" "$base_url/api/inbox" \
  -H "Authorization: Bearer $customer_token")

if [ "$inbox_code" != "200" ]; then
  exit 1
fi

node -e '
const fs=require("fs");
const payload=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const id=process.argv[2];
const target=(payload.messages||[]).find((m)=>m.id===id);
process.exit(target && target.isRead===true ? 0 : 1);
' /tmp/inbox_read_inbox.json "$message_id"
