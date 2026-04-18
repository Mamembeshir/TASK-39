#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"

# Login as staff (service manager) and as customer
staff_login_code=$(curl -sS -o /tmp/content_manage_staff_login.json -w "%{http_code}" \
  -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: content-manage-staff" \
  -d '{"username":"manager_demo","password":"devpass123456"}')

customer_login_code=$(curl -sS -o /tmp/content_manage_customer_login.json -w "%{http_code}" \
  -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: content-manage-customer" \
  -d '{"username":"customer_demo","password":"devpass123456"}')

if [ "$staff_login_code" != "200" ] || [ "$customer_login_code" != "200" ]; then exit 1; fi

staff_token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.accessToken)process.exit(1);process.stdout.write(p.accessToken);' /tmp/content_manage_staff_login.json)
customer_token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.accessToken)process.exit(1);process.stdout.write(p.accessToken);' /tmp/content_manage_customer_login.json)

# GET /api/content/manage — staff-only endpoint returns all content including drafts
staff_code=$(curl -sS -o /tmp/content_manage_result.json -w "%{http_code}" \
  "$base_url/api/content/manage" \
  -H "Authorization: Bearer $staff_token")

if [ "$staff_code" != "200" ]; then exit 1; fi

# Customer must be denied
customer_code=$(curl -sS -o /tmp/content_manage_customer_result.json -w "%{http_code}" \
  "$base_url/api/content/manage" \
  -H "Authorization: Bearer $customer_token")

if [ "$customer_code" != "403" ]; then exit 1; fi

node -e '
const fs=require("fs");
const payload=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
process.exit(Array.isArray(payload) ? 0 : 1);
' /tmp/content_manage_result.json
