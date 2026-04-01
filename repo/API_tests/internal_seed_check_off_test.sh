#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL=${API_BASE_URL:-http://localhost:4000}

echo "[TEST] seed-check off should return 404 and not mutate data"

# seed-check endpoint should be unavailable when disabled
code=$(curl -s -o /tmp/seed_check_response.json -w "%{http_code}" "$API_BASE_URL/api/internal/seed-check" || true)
if [ "$code" != "404" ]; then
  echo "FAIL: seed-check endpoint expected 404, got $code"; exit 1
fi

echo "PASS: seed-check endpoint returned 404 as expected"

# internal fixture route should be unavailable as well
code2=$(curl -s -o /tmp/fixture_response.json -w "%{http_code}" "$API_BASE_URL/api/internal/test-fixtures/booking-slot" || true)
if [ "$code2" != "404" ]; then
  echo "FAIL: internal fixture route expected 404, got $code2"; exit 1
fi

echo "PASS: internal fixtures route returned 404 as expected"
