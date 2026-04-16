#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"

manager_login_code=$(curl -sS -o /tmp/inbox_staff_manager_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: inbox-manager-device" \
  -d '{"username":"manager_demo","password":"devpass123456"}')

customer_login_code=$(curl -sS -o /tmp/inbox_staff_customer_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: inbox-customer-device" \
  -d '{"username":"customer_demo","password":"devpass123456"}')

moderator_login_code=$(curl -sS -o /tmp/inbox_staff_moderator_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: inbox-moderator-device" \
  -d '{"username":"moderator_demo","password":"devpass123456"}')

if [ "$manager_login_code" != "200" ] || [ "$customer_login_code" != "200" ] || [ "$moderator_login_code" != "200" ]; then
  exit 1
fi

manager_token=$(node -e 'const fs=require("fs"); const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(p.accessToken);' /tmp/inbox_staff_manager_login.json)
customer_token=$(node -e 'const fs=require("fs"); const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(p.accessToken);' /tmp/inbox_staff_customer_login.json)
moderator_token=$(node -e 'const fs=require("fs"); const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(p.accessToken);' /tmp/inbox_staff_moderator_login.json)

customer_title="Customer Notice $(date +%s)"
moderator_title="Moderator Notice $(date +%s)"

create_customer_code=$(curl -sS -o /tmp/inbox_staff_create_customer.json -w "%{http_code}" -X POST "$base_url/api/staff/messages" \
  -H "Authorization: Bearer $manager_token" \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"$customer_title\",\"body\":\"hello customer\",\"roles\":[\"customer\"]}")

create_moderator_code=$(curl -sS -o /tmp/inbox_staff_create_moderator.json -w "%{http_code}" -X POST "$base_url/api/staff/messages" \
  -H "Authorization: Bearer $manager_token" \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"$moderator_title\",\"body\":\"hello moderator\",\"roles\":[\"moderator\"]}")

customer_inbox_code=$(curl -sS -o /tmp/inbox_staff_customer_inbox.json -w "%{http_code}" "$base_url/api/inbox" \
  -H "Authorization: Bearer $customer_token")

moderator_inbox_code=$(curl -sS -o /tmp/inbox_staff_moderator_inbox.json -w "%{http_code}" "$base_url/api/inbox" \
  -H "Authorization: Bearer $moderator_token")

if [ "$create_customer_code" != "201" ] || [ "$create_moderator_code" != "201" ] || [ "$customer_inbox_code" != "200" ] || [ "$moderator_inbox_code" != "200" ]; then
  exit 1
fi

node -e '
const fs=require("fs");
const customer=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const moderator=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
const customerTitle=process.argv[3];
const moderatorTitle=process.argv[4];
const customerMessages=customer.messages || [];
const moderatorMessages=moderator.messages || [];
const customerSeesCustomer=customerMessages.some((m) => m.title === customerTitle);
const customerSeesModerator=customerMessages.some((m) => m.title === moderatorTitle);
const moderatorSeesModerator=moderatorMessages.some((m) => m.title === moderatorTitle);
process.exit(customerSeesCustomer && !customerSeesModerator && moderatorSeesModerator ? 0 : 1);
' /tmp/inbox_staff_customer_inbox.json /tmp/inbox_staff_moderator_inbox.json "$customer_title" "$moderator_title"
