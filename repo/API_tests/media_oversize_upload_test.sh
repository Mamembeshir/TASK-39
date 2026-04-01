#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"

login_code=$(curl -sS -o /tmp/media_oversize_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: media-oversize-device" \
  -d '{"username":"customer_demo","password":"devpass123456"}')

if [ "$login_code" != "200" ]; then
  exit 1
fi

token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.accessToken) process.exit(1);process.stdout.write(p.accessToken);' /tmp/media_oversize_login.json)

node -e '
const fs=require("fs");
const size=(10*1024*1024)+1024;
const buf=Buffer.alloc(size, 0);
buf[0]=0x89; buf[1]=0x50; buf[2]=0x4e; buf[3]=0x47; buf[4]=0x0d; buf[5]=0x0a; buf[6]=0x1a; buf[7]=0x0a;
fs.writeFileSync("/tmp/oversize.png", buf);
'

upload_code=$(curl -sS -o /tmp/media_oversize_response.json -w "%{http_code}" -X POST "$base_url/api/media" \
  -H "Authorization: Bearer $token" \
  -F "purpose=review" \
  -F "files=@/tmp/oversize.png;type=image/png")

if [ "$upload_code" != "400" ]; then
  exit 1
fi

node -e '
const fs=require("fs");
const payload=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
process.exit(payload && payload.code === "FILE_TOO_LARGE" ? 0 : 1);
' /tmp/media_oversize_response.json
