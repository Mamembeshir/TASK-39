#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"

login_code=$(curl -sS -o /tmp/content_invalid_media_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: content-invalid-media-device" \
  -d '{"username":"admin_demo","password":"devpass123456"}')

if [ "$login_code" != "200" ]; then
  exit 1
fi

token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.accessToken) process.exit(1);process.stdout.write(p.accessToken);' /tmp/content_invalid_media_login.json)

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
fs.writeFileSync("/tmp/content-invalid-media.png", Buffer.from(bytes));
'

upload_code=$(curl -sS -o /tmp/content_invalid_media_upload.json -w "%{http_code}" -X POST "$base_url/api/media" \
  -H "Authorization: Bearer $token" \
  -F "purpose=review" \
  -F "files=@/tmp/content-invalid-media.png;type=image/png")

if [ "$upload_code" != "201" ]; then
  exit 1
fi

media_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));const media=(p.media||[])[0];if(!media||!media.mediaId)process.exit(1);process.stdout.write(media.mediaId);' /tmp/content_invalid_media_upload.json)
slug="content-invalid-media-$(date +%s)"

payload=$(cat <<EOF
{"slug":"$slug","title":"invalid media purpose","body":"{\"type\":\"doc\",\"content\":[{\"type\":\"media\",\"attrs\":{\"mediaId\":\"$media_id\"}}]}","mediaIds":["$media_id"]}
EOF
)

create_code=$(curl -sS -o /tmp/content_invalid_media_create.json -w "%{http_code}" -X POST "$base_url/api/content" \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d "$payload")

if [ "$create_code" != "400" ]; then
  exit 1
fi

node -e '
const fs=require("fs");
const payload=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
process.exit(payload && payload.code === "INVALID_MEDIA_PURPOSE" ? 0 : 1);
' /tmp/content_invalid_media_create.json
