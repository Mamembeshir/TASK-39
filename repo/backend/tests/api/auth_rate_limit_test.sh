#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"
username="ratelimit_$(date +%s)"
password="ratelimit-devpass-123"

register_code=$(curl -sS -o /tmp/auth_ratelimit_register.json -w "%{http_code}" -X POST "$base_url/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$username\",\"password\":\"$password\"}")

if [ "$register_code" != "201" ]; then
  exit 1
fi

login_code=$(curl -sS -o /tmp/auth_ratelimit_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: rate-limit-device" \
  -d "{\"username\":\"$username\",\"password\":\"$password\"}")

if [ "$login_code" != "200" ]; then
  exit 1
fi

token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.accessToken) process.exit(1);process.stdout.write(p.accessToken);' /tmp/auth_ratelimit_login.json)

count=1
got_429=0
while [ $count -le 65 ]; do
  code=$(curl -sS -o /tmp/auth_ratelimit_me.json -w "%{http_code}" "$base_url/api/auth/me" \
    -H "Authorization: Bearer $token")

  if [ "$code" = "429" ]; then
    got_429=1
    break
  fi

  if [ "$code" != "200" ]; then
    exit 1
  fi

  count=$((count + 1))
done

if [ "$got_429" != "1" ]; then
  exit 1
fi

node -e '
const fs = require("fs");
const payload = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
process.exit(payload && payload.code === "RATE_LIMITED" ? 0 : 1);
' /tmp/auth_ratelimit_me.json
