#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"
service_id="65f000000000000000000101"

# Login as manager (staff role)
login_code=$(curl -sS -o /tmp/staff_slots_login.json -w "%{http_code}" \
  -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: staff-slots-device" \
  -d '{"username":"manager_demo","password":"devpass123456"}')

if [ "$login_code" != "200" ]; then exit 1; fi

token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.accessToken)process.exit(1);process.stdout.write(p.accessToken);' /tmp/staff_slots_login.json)

# GET /api/staff/orders/slots — list capacity slots
list_code=$(curl -sS -o /tmp/staff_slots_list.json -w "%{http_code}" \
  "$base_url/api/staff/orders/slots" \
  -H "Authorization: Bearer $token")

if [ "$list_code" != "200" ]; then exit 1; fi

node -e '
const fs=require("fs");
const payload=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
process.exit(Array.isArray(payload) ? 0 : 1);
' /tmp/staff_slots_list.json || exit 1

# POST /api/staff/orders/slots — create a new capacity slot
start_time=$(node -e 'process.stdout.write(new Date(Date.now()+7*24*60*60*1000).toISOString())')

create_code=$(curl -sS -o /tmp/staff_slots_create.json -w "%{http_code}" \
  -X POST "$base_url/api/staff/orders/slots" \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d "{\"serviceId\":\"$service_id\",\"startTime\":\"$start_time\",\"remainingCapacity\":3}")

if [ "$create_code" != "201" ]; then exit 1; fi

slot_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.id)process.exit(1);process.stdout.write(p.id);' /tmp/staff_slots_create.json)

# DELETE /api/staff/orders/slots/:id — remove the slot
delete_code=$(curl -sS -o /tmp/staff_slots_delete.json -w "%{http_code}" \
  -X DELETE "$base_url/api/staff/orders/slots/$slot_id" \
  -H "Authorization: Bearer $token")

if [ "$delete_code" != "200" ]; then exit 1; fi

node -e '
const fs=require("fs");
const payload=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
process.exit(payload && payload.status==="ok" ? 0 : 1);
' /tmp/staff_slots_delete.json
