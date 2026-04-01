#!/bin/sh

API_BASE_URL="${API_BASE_URL:-http://api:4000}"
TEST_MONGO_URI="${TEST_MONGO_URI:-mongodb://mongodb:27017/homecareops_test}"
BACKEND_DIR="${BACKEND_DIR:-$(pwd)/backend}"
FRONTEND_DIR="${FRONTEND_DIR:-$(pwd)/frontend}"

total=0
passed=0
failed=0

cleanup() {
  status=$?
  trap - EXIT
  MONGO_URI="$TEST_MONGO_URI" node "$BACKEND_DIR/src/scripts/dropTestDatabase.js" || status=1
  exit "$status"
}

wait_for_api() {
  attempts=0
  until curl -fsS "$API_BASE_URL/api/health" >/dev/null 2>&1; do
    attempts=$((attempts + 1))
    if [ "$attempts" -ge 60 ]; then
      echo "API did not become ready in time"
      return 1
    fi
    sleep 2
  done
}

trap cleanup EXIT

run_test() {
  name="$1"
  command="$2"
  total=$((total + 1))

  if sh -c "$command"; then
    passed=$((passed + 1))
    echo "PASS: $name"
  else
    failed=$((failed + 1))
    echo "FAIL: $name"
  fi
}

if ! wait_for_api; then
  exit 1
fi

run_test "API health endpoint returns 200 and status ok" "./API_tests/health_check_test.sh"
run_test "Seed data exists and customer account is present" "./API_tests/seed_check_test.sh"
run_test "Unique username constraint is enforced" "./API_tests/unique_username_test.sh"
run_test "Auth login succeeds with seeded account" "./API_tests/auth_login_success_test.sh"
run_test "Auth missing token returns 401" "./API_tests/auth_missing_token_401_test.sh"
run_test "Auth wrong role returns 403" "./API_tests/auth_wrong_role_403_test.sh"
run_test "Authorization matrix critical route enforcement" "./API_tests/authorization_matrix_test.sh"
run_test "Object-level authorization ownership checks" "./API_tests/ola_access_control_test.sh"
run_test "Validation errors use consistent shape" "./API_tests/validation_error_shape_test.sh"
run_test "Auth rejects wrong password" "./API_tests/auth_wrong_password_test.sh"
run_test "Auth locks account on sixth failed attempt" "./API_tests/auth_lockout_test.sh"
run_test "Auth rate limit returns 429" "./API_tests/auth_rate_limit_test.sh"
run_test "Auth login returns new-device security event once" "./API_tests/auth_new_device_event_test.sh"
run_test "Auth and public responses expose rate-limit headers" "./API_tests/rate_limit_headers_test.sh"
run_test "Admin audit exposes new-device risk metadata" "./API_tests/admin_audit_risk_test.sh"
run_test "Catalog hides unpublished services from public" "./API_tests/catalog_unpublished_visibility_test.sh"
run_test "Catalog publish makes service visible" "./API_tests/catalog_publish_visibility_test.sh"
run_test "Catalog filters services by category and tags" "./API_tests/catalog_filter_query_test.sh"
run_test "Catalog rejects invalid service spec" "./API_tests/catalog_invalid_spec_test.sh"
run_test "Bundle quote uses component defaults" "./API_tests/bundle_quote_defaults_test.sh"
run_test "Quote rejects invalid headcount tools and add-ons" "./API_tests/quote_invalid_spec_validation_test.sh"
run_test "Content rejects non-content embedded media" "./API_tests/content_invalid_media_purpose_test.sh"
run_test "Structured content body publishes and reads publicly" "./API_tests/content_structured_body_public_test.sh"
run_test "Favorites add/get/delete roundtrip" "./API_tests/favorites_roundtrip_test.sh"
run_test "Favorites and compare requirement regression" "./API_tests/favorites_compare_requirement_test.sh"
run_test "Compare list rejects more than five services" "./API_tests/compare_limit_test.sh"
run_test "Order booking concurrency uses atomic slot decrement" "./API_tests/order_concurrency_test.sh"
run_test "Media upload rejects oversized file" "./API_tests/media_oversize_upload_test.sh"
run_test "Media MIME and magic-byte validation rejects spoofed files" "./API_tests/media_magic_mime_validation_test.sh"
run_test "Media duplicate upload deduplicates by hash" "./API_tests/media_dedup_test.sh"
run_test "One review per order is enforced" "./API_tests/review_duplicate_per_order_test.sh"
run_test "Review submission window expires after 14 days" "./API_tests/review_window_expired_test.sh"
run_test "Verified approved review appears in service reviews" "./API_tests/review_verified_visibility_test.sh"
run_test "Quarantined review hidden from public list" "./API_tests/review_quarantine_visibility_test.sh"
run_test "Ticket create requires order id" "./API_tests/ticket_missing_order_test.sh"
run_test "Ticket category routes to deterministic team queue" "./API_tests/ticket_category_routing_test.sh"
run_test "Ticket resolve outcome is immutable" "./API_tests/ticket_resolve_immutable_test.sh"
run_test "Ticket staff actions update pause and legal hold state" "./API_tests/ticket_staff_actions_test.sh"
run_test "Retention policy prunes closed ticket attachments unless legal hold" "./API_tests/retention_legal_hold_policy_test.sh"
run_test "Ticket SLA fields use business-hours fixture" "./API_tests/ticket_sla_fields_test.sh"
run_test "Scheduled content stays non-public until publish" "./API_tests/content_schedule_visibility_test.sh"
run_test "Content rollback updates published pointer" "./API_tests/content_rollback_test.sh"
run_test "Media delete blocked when referenced" "./API_tests/media_delete_blocked_test.sh"
run_test "Inbox hides moderator-only message from customer" "./API_tests/inbox_role_visibility_test.sh"
run_test "Inbox mark-read persists per user" "./API_tests/inbox_mark_read_test.sh"
run_test "Search returns only published entities" "./API_tests/search_published_only_test.sh"
run_test "Search cleanup script smoke test" "./API_tests/search_cleanup_smoke_test.sh"
run_test "Retention cleanup script smoke test" "./API_tests/retention_cleanup_smoke_test.sh"
run_test "Customer views are masked while staff views full contact" "./API_tests/masking_profile_order_test.sh"
run_test "Admin blacklist endpoint blocks forwarded IP" "./API_tests/admin_blacklist_upsert_test.sh"
run_test "Staff inbox messages respect role visibility" "./API_tests/inbox_staff_visibility_test.sh"
run_test "Blacklisted IP cannot access API" "./API_tests/blacklist_ip_test.sh"
run_test "Backend node unit and service tests" "npm --prefix ./backend run test:unit"
run_test "Unit password length validation" "./unit_tests/password_length_test.sh"
run_test "Unit quote pricing matrix" "./unit_tests/quote_pricing_test.sh"
run_test "Unit production errors omit stack" "./unit_tests/production_error_no_stack_test.sh"
run_test "Frontend Vitest suite" "npm --prefix ./frontend test"

echo "TOTAL: $total, PASSED: $passed, FAILED: $failed"

if [ "$failed" -eq 0 ]; then
  exit 0
fi

exit 1
