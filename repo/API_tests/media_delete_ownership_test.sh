#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"

login_a_code=$(curl -sS -o /tmp/media_owner_login_a.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: media-owner-a" \
  -d '{"username":"customer_demo","password":"devpass123456"}')

if [ "$login_a_code" != "200" ]; then
  exit 1
fi

token_a=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.accessToken)process.exit(1);process.stdout.write(p.accessToken);' /tmp/media_owner_login_a.json)

username_b="media_owner_b_$(date +%s)"
password_b="media-owner-pass-123"

register_b_code=$(curl -sS -o /tmp/media_owner_register_b.json -w "%{http_code}" -X POST "$base_url/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$username_b\",\"password\":\"$password_b\"}")

if [ "$register_b_code" != "201" ]; then
  exit 1
fi

login_b_code=$(curl -sS -o /tmp/media_owner_login_b.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: media-owner-b" \
  -d "{\"username\":\"$username_b\",\"password\":\"$password_b\"}")

if [ "$login_b_code" != "200" ]; then
  exit 1
fi

token_b=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.accessToken)process.exit(1);process.stdout.write(p.accessToken);' /tmp/media_owner_login_b.json)

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
fs.writeFileSync("/tmp/media-owner.png", Buffer.from(bytes));
'

upload_code=$(curl -sS -o /tmp/media_owner_upload.json -w "%{http_code}" -X POST "$base_url/api/media" \
  -H "Authorization: Bearer $token_a" \
  -F "purpose=review" \
  -F "files=@/tmp/media-owner.png;type=image/png")

if [ "$upload_code" != "201" ]; then
  exit 1
fi

media_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));const m=(p.media||[])[0];if(!m||!m.mediaId)process.exit(1);process.stdout.write(m.mediaId);' /tmp/media_owner_upload.json)

delete_b_code=$(curl -sS -o /tmp/media_owner_delete_b.json -w "%{http_code}" -X DELETE "$base_url/api/media/$media_id" \
  -H "Authorization: Bearer $token_b")

if [ "$delete_b_code" != "404" ]; then
  exit 1
fi

node -e '
const fs=require("fs");
const denied=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
process.exit(denied && denied.code === "MEDIA_NOT_FOUND" ? 0 : 1);
' /tmp/media_owner_delete_b.json

delete_a_code=$(curl -sS -o /tmp/media_owner_delete_a.json -w "%{http_code}" -X DELETE "$base_url/api/media/$media_id" \
  -H "Authorization: Bearer $token_a")

if [ "$delete_a_code" != "200" ]; then
  exit 1
fi

node -e '
const fs=require("fs");
const ok=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
process.exit(ok && ok.status === "ok" ? 0 : 1);
' /tmp/media_owner_delete_a.json
