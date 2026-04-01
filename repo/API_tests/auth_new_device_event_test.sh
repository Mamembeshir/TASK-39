#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"

first_code=$(curl -sS -o /tmp/auth_new_device_first.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: hardened-device-a" \
  -d '{"username":"customer_demo","password":"devpass123456"}')

second_code=$(curl -sS -o /tmp/auth_new_device_second.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: hardened-device-a" \
  -d '{"username":"customer_demo","password":"devpass123456"}')

third_code=$(curl -sS -o /tmp/auth_new_device_third.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: hardened-device-b" \
  -d '{"username":"customer_demo","password":"devpass123456"}')

if [ "$first_code" != "200" ] || [ "$second_code" != "200" ] || [ "$third_code" != "200" ]; then
  exit 1
fi

node -e '
const fs=require("fs");
const first=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const second=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
const third=JSON.parse(fs.readFileSync(process.argv[3],"utf8"));
const firstOk = first.securityEvent && first.securityEvent.type === "new_device_login" && first.securityEvent.isNewDevice === true;
const secondOk = second.securityEvent === null;
const thirdOk = third.securityEvent && third.securityEvent.type === "new_device_login" && third.securityEvent.risk && third.securityEvent.risk.category;
process.exit(firstOk && secondOk && thirdOk ? 0 : 1);
' /tmp/auth_new_device_first.json /tmp/auth_new_device_second.json /tmp/auth_new_device_third.json
