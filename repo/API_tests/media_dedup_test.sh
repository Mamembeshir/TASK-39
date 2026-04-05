#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"

login_code=$(curl -sS -o /tmp/media_dedup_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: media-dedup-device" \
  -d '{"username":"customer_demo","password":"devpass123456"}')

if [ "$login_code" != "200" ]; then
  exit 1
fi

token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.accessToken) process.exit(1);process.stdout.write(p.accessToken);' /tmp/media_dedup_login.json)

node -e '
const fs=require("fs");
const bytes=[
  0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,
  0x00,0x00,0x00,0x0d,0x49,0x48,0x44,0x52,
  0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x01,
  0x08,0x02,0x00,0x00,0x00,0x90,0x77,0x53,
  0xde,0x00,0x00,0x00,0x0a,0x49,0x44,0x41,
  0x54,0x78,0x9c,0x63,0x60,0x00,0x00,0x00,
  0x02,0x00,0x01,0xe5,0x27,0xd4,0xa2,0x00,
  0x00,0x00,0x00,0x49,0x45,0x4e,0x44,0xae,
  0x42,0x60,0x82
];
fs.writeFileSync("/tmp/dedup.png", Buffer.from(bytes));
'

first_code=$(curl -sS -o /tmp/media_dedup_first.json -w "%{http_code}" -X POST "$base_url/api/media" \
  -H "Authorization: Bearer $token" \
  -F "purpose=review" \
  -F "files=@/tmp/dedup.png;type=image/png")

second_code=$(curl -sS -o /tmp/media_dedup_second.json -w "%{http_code}" -X POST "$base_url/api/media" \
  -H "Authorization: Bearer $token" \
  -F "purpose=review" \
  -F "files=@/tmp/dedup.png;type=image/png")

if [ "$first_code" != "201" ] || [ "$second_code" != "201" ]; then
  exit 1
fi

node -e '
const fs=require("fs");
const first=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const second=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
const f=(first.media||[])[0];
const s=(second.media||[])[0];
const ok = f && s && f.mediaId === s.mediaId && s.deduplicated === true;
process.exit(ok ? 0 : 1);
' /tmp/media_dedup_first.json /tmp/media_dedup_second.json
