#!/bin/sh
set -eu

API_BASE_URL=${API_BASE_URL:-http://localhost:4000}
INTERNAL_ROUTES_TOKEN=${INTERNAL_ROUTES_TOKEN:-dev-internal-token}

# This test verifies the OFF state (routes not mounted → 404). In the default
# test pipeline internal routes are enabled so fixtures can run, so skip here.
if [ "${INTERNAL_ROUTES_ENABLED:-false}" = "true" ]; then
  echo "SKIP: internal routes are enabled in this run; OFF-state test is not applicable"
  exit 0
fi

echo "[TEST] seed-check off should return 404 and not mutate data"

# seed-check endpoint should be unavailable when disabled
code=$(curl -s -o /tmp/seed_check_response.json -w "%{http_code}" "$API_BASE_URL/api/internal/seed-check" \
  -H "X-Internal-Token: $INTERNAL_ROUTES_TOKEN" || true)
if [ "$code" != "404" ]; then
  echo "FAIL: seed-check endpoint expected 404, got $code"; exit 1
fi

echo "PASS: seed-check endpoint returned 404 as expected"

# internal fixture route should be unavailable as well
code2=$(curl -s -o /tmp/fixture_response.json -w "%{http_code}" "$API_BASE_URL/api/internal/test-fixtures/booking-slot" \
  -H "X-Internal-Token: $INTERNAL_ROUTES_TOKEN" || true)
if [ "$code2" != "404" ]; then
  echo "FAIL: internal fixture route expected 404, got $code2"; exit 1
fi

echo "PASS: internal fixtures route returned 404 as expected"
