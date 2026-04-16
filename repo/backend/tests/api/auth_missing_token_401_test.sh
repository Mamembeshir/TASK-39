#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"

code=$(curl -sS -o /tmp/auth_missing_token.json -w "%{http_code}" "$base_url/api/auth/me")

if [ "$code" != "401" ]; then
  exit 1
fi

node -e '
const fs=require("fs");
const payload=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
process.exit(payload && payload.code === "UNAUTHORIZED" ? 0 : 1);
' /tmp/auth_missing_token.json
