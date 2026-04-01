#!/bin/sh

response_file="/tmp/unique_username_response.json"
base_url="${API_BASE_URL:-http://api:4000}"
http_code=$(curl -sS -X POST -o "$response_file" -w "%{http_code}" "$base_url/api/internal/constraints/users-username")

if [ "$http_code" != "200" ]; then
  exit 1
fi

node -e '
const fs = require("fs");
const payload = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
process.exit(payload && payload.enforced === true ? 0 : 1);
' "$response_file"
