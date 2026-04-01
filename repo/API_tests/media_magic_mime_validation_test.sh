#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"

login_code=$(curl -sS -o /tmp/media_magic_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: media-magic-device" \
  -d '{"username":"customer_demo","password":"devpass123456"}')

if [ "$login_code" != "200" ]; then
  exit 1
fi

token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.accessToken);' /tmp/media_magic_login.json)

node -e 'require("fs").writeFileSync("/tmp/fake-image.png", "not-a-real-image")'

spoof_code=$(curl -sS -o /tmp/media_magic_spoof.json -w "%{http_code}" -X POST "$base_url/api/media" \
  -H "Authorization: Bearer $token" \
  -F "purpose=review" \
  -F "files=@/tmp/fake-image.png;type=image/png")

unsupported_code=$(curl -sS -o /tmp/media_magic_unsupported.json -w "%{http_code}" -X POST "$base_url/api/media" \
  -H "Authorization: Bearer $token" \
  -F "purpose=review" \
  -F "files=@/tmp/fake-image.png;type=text/plain")

if [ "$spoof_code" != "400" ] || [ "$unsupported_code" != "400" ]; then
  exit 1
fi

node -e '
const fs=require("fs");
const spoof=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const unsupported=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
const ok = spoof.code === "MIME_MISMATCH" && unsupported.code === "UNSUPPORTED_MEDIA_TYPE";
process.exit(ok ? 0 : 1);
' /tmp/media_magic_spoof.json /tmp/media_magic_unsupported.json
