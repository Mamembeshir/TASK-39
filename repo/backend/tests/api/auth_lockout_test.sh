#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"
username="lockuser_$(date +%s)"
password="lockout-devpass-123"

register_code=$(curl -sS -o /tmp/auth_lockout_register.json -w "%{http_code}" -X POST "$base_url/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$username\",\"password\":\"$password\"}")

if [ "$register_code" != "201" ]; then
  exit 1
fi

attempt=1
while [ $attempt -le 5 ]; do
  code=$(curl -sS -o /tmp/auth_lockout_attempt.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$username\",\"password\":\"wrong-password\"}")

  if [ "$code" != "401" ] && [ "$code" != "423" ]; then
    exit 1
  fi
  attempt=$((attempt + 1))
done

sixth_code=$(curl -sS -o /tmp/auth_lockout_sixth.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$username\",\"password\":\"wrong-password\"}")

if [ "$sixth_code" != "423" ]; then
  exit 1
fi

node -e '
const fs = require("fs");
const payload = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
process.exit(payload && payload.code === "ACCOUNT_LOCKED" ? 0 : 1);
' /tmp/auth_lockout_sixth.json
