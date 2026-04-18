#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"

login_code=$(curl -sS -o /tmp/media_file_get_login.json -w "%{http_code}" \
  -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: media-file-get-device" \
  -d '{"username":"customer_demo","password":"devpass123456"}')

if [ "$login_code" != "200" ]; then exit 1; fi

token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.accessToken)process.exit(1);process.stdout.write(p.accessToken);' /tmp/media_file_get_login.json)

# Create a minimal valid PNG file
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
fs.writeFileSync("/tmp/media-file-get.png", Buffer.from(bytes));
'

# Upload a file (purpose=review routes to the authenticated private store)
upload_code=$(curl -sS -o /tmp/media_file_get_upload.json -w "%{http_code}" \
  -X POST "$base_url/api/media" \
  -H "Authorization: Bearer $token" \
  -F "purpose=review" \
  -F "files=@/tmp/media-file-get.png;type=image/png")

if [ "$upload_code" != "201" ]; then exit 1; fi

media_id=$(node -e '
const fs=require("fs");
const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const m=(p.media||[])[0];
if(!m||!m.mediaId)process.exit(1);
process.stdout.write(m.mediaId);
' /tmp/media_file_get_upload.json)

# GET /api/media/files/:id — authenticated fetch of a private media file
get_code=$(curl -sS -o /tmp/media_file_get_result.bin -w "%{http_code}" \
  "$base_url/api/media/files/$media_id" \
  -H "Authorization: Bearer $token")

if [ "$get_code" != "200" ]; then exit 1; fi
