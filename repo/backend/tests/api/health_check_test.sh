#!/bin/sh

response_file="/tmp/health_response.json"
base_url="${API_BASE_URL:-http://api:4000}"
http_code=$(curl -sS -o "$response_file" -w "%{http_code}" "$base_url/api/health")
body=$(tr -d '\n' < "$response_file")

if [ "$http_code" = "200" ] && [ "$body" = '{"status":"ok"}' ]; then
  exit 0
fi

exit 1
