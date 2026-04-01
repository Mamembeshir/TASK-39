#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"
order_id="65f000000000000000000401"
phone="+1-415-555-0199"
address="123 Main Street, Springfield"

customer_login_code=$(curl -sS -o /tmp/mask_customer_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: mask-customer-device" \
  -d '{"username":"customer_demo","password":"devpass123456"}')

admin_login_code=$(curl -sS -o /tmp/mask_admin_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: mask-admin-device" \
  -d '{"username":"admin_demo","password":"devpass123456"}')

if [ "$customer_login_code" != "200" ] || [ "$admin_login_code" != "200" ]; then
  exit 1
fi

customer_token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.accessToken);' /tmp/mask_customer_login.json)
admin_token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.accessToken);' /tmp/mask_admin_login.json)

update_code=$(curl -sS -o /tmp/mask_update_contact.json -w "%{http_code}" -X PUT "$base_url/api/profile/contact" \
  -H "Authorization: Bearer $customer_token" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"$phone\",\"address\":\"$address\"}")

if [ "$update_code" != "200" ]; then
  exit 1
fi

profile_code=$(curl -sS -o /tmp/mask_profile_me.json -w "%{http_code}" "$base_url/api/profile/me" \
  -H "Authorization: Bearer $customer_token")

if [ "$profile_code" != "200" ]; then
  exit 1
fi

order_code=$(curl -sS -o /tmp/mask_order_staff.json -w "%{http_code}" "$base_url/api/orders/$order_id" \
  -H "Authorization: Bearer $admin_token")

if [ "$order_code" != "200" ]; then
  exit 1
fi

node -e '
const fs=require("fs");
const phone=process.argv[3];
const address=process.argv[4];
const profile=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const order=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));

const profilePhone=profile.profile && profile.profile.phone;
const profileAddress=profile.profile && profile.profile.address;
const staffPhone=order.order && order.order.customerContact && order.order.customerContact.phone;
const staffAddress=order.order && order.order.customerContact && order.order.customerContact.address;

const maskedOk = profilePhone && profilePhone !== phone && profileAddress && profileAddress !== address;
const staffOk = staffPhone === phone && staffAddress === address;
process.exit(maskedOk && staffOk ? 0 : 1);
' /tmp/mask_profile_me.json /tmp/mask_order_staff.json "$phone" "$address"
