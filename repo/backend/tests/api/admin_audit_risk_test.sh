#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"

customer_login_code=$(curl -sS -o /tmp/admin_audit_customer_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: audit-risk-device-a" \
  -d '{"username":"customer_demo","password":"devpass123456"}')

admin_login_code=$(curl -sS -o /tmp/admin_audit_admin_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: audit-admin-device" \
  -d '{"username":"admin_demo","password":"devpass123456"}')

if [ "$customer_login_code" != "200" ] || [ "$admin_login_code" != "200" ]; then
  exit 1
fi

admin_token=$(node -e 'const fs=require("fs"); const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(p.accessToken);' /tmp/admin_audit_admin_login.json)

audit_code=$(curl -sS -o /tmp/admin_audit_logs.json -w "%{http_code}" "$base_url/api/admin/audit" \
  -H "Authorization: Bearer $admin_token")

if [ "$audit_code" != "200" ]; then
  exit 1
fi

node -e '
const fs=require("fs");
const logs=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const match=(logs||[]).find((entry) => entry.action === "auth.login" && entry.metadata?.isNewDevice === true && entry.metadata?.risk?.category);
process.exit(match ? 0 : 1);
' /tmp/admin_audit_logs.json
