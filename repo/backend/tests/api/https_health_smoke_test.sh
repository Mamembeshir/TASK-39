#!/bin/sh

response_file="/tmp/https_health_response.json"
https_base_url="${API_HTTPS_BASE_URL:-https://proxy}"
http_code=$(curl -k -sS -o "$response_file" -w "%{http_code}" "$https_base_url/api/health")
body=$(tr -d '\n' < "$response_file")

if [ "$http_code" = "200" ] && [ "$body" = '{"status":"ok"}' ]; then
  exit 0
fi

exit 1
