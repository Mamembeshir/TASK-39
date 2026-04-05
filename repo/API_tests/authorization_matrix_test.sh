#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"
dummy_id="65f00000000000000000d001"
cookie_file="/tmp/authorization_matrix_login.cookies"

assert_code() {
  expected="$1"
  method="$2"
  path="$3"
  cookie_enabled="$4"

  if [ "$cookie_enabled" = "cookie" ]; then
    code=$(curl -sS -o /tmp/authorization_matrix_response.json -w "%{http_code}" -X "$method" "$base_url$path" \
      -b "$cookie_file" \
      -H "X-Expected-Auth-Failure: 1" \
      -H "Content-Type: application/json" \
      -d '{}')
  elif [ -n "$cookie_enabled" ]; then
    code=$(curl -sS -o /tmp/authorization_matrix_response.json -w "%{http_code}" -X "$method" "$base_url$path" \
      -H "Authorization: Bearer $cookie_enabled" \
      -H "X-Expected-Auth-Failure: 1" \
      -H "Content-Type: application/json" \
      -d '{}')
  else
    code=$(curl -sS -o /tmp/authorization_matrix_response.json -w "%{http_code}" -X "$method" "$base_url$path" \
      -H "X-Expected-Auth-Failure: 1" \
      -H "Content-Type: application/json" \
      -d '{}')
  fi

  if [ "$code" != "$expected" ]; then
    exit 1
  fi
}

login_code=$(curl -sS -c "$cookie_file" -o /tmp/authorization_matrix_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: authorization-matrix-customer" \
  -d '{"username":"customer_demo","password":"devpass123456"}')

if [ "$login_code" != "200" ]; then
  exit 1
fi

# 14 sensitive routes without token -> 401
assert_code "401" "POST" "/api/orders" ""
assert_code "401" "GET" "/api/orders/$dummy_id" ""
assert_code "401" "POST" "/api/orders/$dummy_id/cancel" ""
assert_code "401" "POST" "/api/tickets" ""
assert_code "401" "GET" "/api/tickets/$dummy_id" ""
assert_code "401" "POST" "/api/tickets/$dummy_id/status" ""
assert_code "401" "POST" "/api/tickets/$dummy_id/resolve" ""
assert_code "401" "POST" "/api/moderation/reviews/$dummy_id/approve" ""
assert_code "401" "POST" "/api/staff/services" ""
assert_code "401" "POST" "/api/staff/services/$dummy_id/publish" ""
assert_code "401" "POST" "/api/staff/orders/$dummy_id/complete" ""
assert_code "401" "POST" "/api/content/$dummy_id/publish" ""
assert_code "401" "POST" "/api/staff/messages" ""
assert_code "401" "POST" "/api/staff/bundles/$dummy_id/publish" ""

# customer token on admin/moderation routes -> 403
assert_code "403" "POST" "/api/staff/services" "cookie"
assert_code "403" "POST" "/api/staff/services/$dummy_id/publish" "cookie"
assert_code "403" "POST" "/api/staff/orders/$dummy_id/complete" "cookie"
assert_code "403" "POST" "/api/tickets/$dummy_id/resolve" "cookie"
assert_code "403" "POST" "/api/tickets/$dummy_id/legal-hold" "cookie"
assert_code "403" "POST" "/api/moderation/reviews/$dummy_id/approve" "cookie"
assert_code "403" "POST" "/api/content/$dummy_id/publish" "cookie"
assert_code "403" "POST" "/api/staff/messages" "cookie"
assert_code "403" "POST" "/api/staff/bundles/$dummy_id/publish" "cookie"
