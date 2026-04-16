#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"

code=$(curl -sS -o /tmp/validation_shape.json -w "%{http_code}" -X POST "$base_url/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{}')

if [ "$code" != "400" ]; then
  exit 1
fi

node -e '
const fs=require("fs");
const payload=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const ok = payload && payload.code === "VALIDATION_ERROR" && Array.isArray(payload.details) && payload.details.length > 0;
process.exit(ok ? 0 : 1);
' /tmp/validation_shape.json
