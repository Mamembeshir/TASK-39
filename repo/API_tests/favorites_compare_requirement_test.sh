#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"
favorite_service_id="65f000000000000000000101"
compare_five='["65f000000000000000000101","65f000000000000000000102","65f000000000000000000103","65f000000000000000000104","65f000000000000000000101"]'
compare_six='["65f000000000000000000101","65f000000000000000000102","65f000000000000000000103","65f000000000000000000104","65f000000000000000000101","65f000000000000000000102"]'

login_code=$(curl -sS -o /tmp/fav_compare_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: fav-compare-device" \
  -d '{"username":"customer_demo","password":"devpass123456"}')

if [ "$login_code" != "200" ]; then
  exit 1
fi

token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.accessToken);' /tmp/fav_compare_login.json)

add_code=$(curl -sS -o /tmp/fav_compare_add.json -w "%{http_code}" -X POST "$base_url/api/favorites/$favorite_service_id" \
  -H "Authorization: Bearer $token")
list_code=$(curl -sS -o /tmp/fav_compare_list.json -w "%{http_code}" "$base_url/api/favorites" \
  -H "Authorization: Bearer $token")
delete_code=$(curl -sS -o /tmp/fav_compare_delete.json -w "%{http_code}" -X DELETE "$base_url/api/favorites/$favorite_service_id" \
  -H "Authorization: Bearer $token")
post_delete_list_code=$(curl -sS -o /tmp/fav_compare_post_delete.json -w "%{http_code}" "$base_url/api/favorites" \
  -H "Authorization: Bearer $token")

compare_five_code=$(curl -sS -o /tmp/fav_compare_five.json -w "%{http_code}" -X PUT "$base_url/api/compare" \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d "{\"serviceIds\":$compare_five}")

compare_get_code=$(curl -sS -o /tmp/fav_compare_get.json -w "%{http_code}" "$base_url/api/compare" \
  -H "Authorization: Bearer $token")

compare_six_code=$(curl -sS -o /tmp/fav_compare_six.json -w "%{http_code}" -X PUT "$base_url/api/compare" \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d "{\"serviceIds\":$compare_six}")

if [ "$add_code" != "200" ] || [ "$list_code" != "200" ] || [ "$delete_code" != "200" ] || [ "$post_delete_list_code" != "200" ] || [ "$compare_five_code" != "200" ] || [ "$compare_get_code" != "200" ] || [ "$compare_six_code" != "400" ]; then
  exit 1
fi

node -e '
const fs=require("fs");
const favoriteId=process.argv[1];
const beforeDelete=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
const afterDelete=JSON.parse(fs.readFileSync(process.argv[3],"utf8"));
const compareSaved=JSON.parse(fs.readFileSync(process.argv[4],"utf8"));
const compareRejected=JSON.parse(fs.readFileSync(process.argv[5],"utf8"));
const favoriteFound=(beforeDelete.favorites||[]).some((item)=>item.id===favoriteId);
const favoriteRemoved=(afterDelete.favorites||[]).every((item)=>item.id!==favoriteId);
const compareSavedOk=Array.isArray(compareSaved.serviceIds) && compareSaved.serviceIds.length===4;
const compareRejectedOk=compareRejected.code==="COMPARE_LIMIT_EXCEEDED";
process.exit(favoriteFound && favoriteRemoved && compareSavedOk && compareRejectedOk ? 0 : 1);
' "$favorite_service_id" /tmp/fav_compare_list.json /tmp/fav_compare_post_delete.json /tmp/fav_compare_get.json /tmp/fav_compare_six.json
