#!/bin/sh

API_BASE_URL="${API_BASE_URL:-http://api:4000}"
TEST_MONGO_URI="${TEST_MONGO_URI:-mongodb://mongodb:27017/homecareops_test}"
BACKEND_DIR="${BACKEND_DIR:-$(pwd)/backend}"

if [ "${RUN_TESTS_IN_CONTAINER:-0}" != "1" ]; then
  if command -v docker >/dev/null 2>&1; then
    # Two-phase pipeline:
    #   Phase 1 — playwright: E2E tests
    #   Phase 2 — test-runner: unit + API + frontend Vitest with coverage (runs only if phase 1 passes)
    # Developers can invoke this script OR control both phases with the same
    # env-var overrides for identical behaviour.
    docker compose down --remove-orphans

    export NODE_ENV=test
    export AUTH_RESPONSE_INCLUDE_TOKENS=true
    export SEED_FIXTURES=true
    export INTERNAL_ROUTES_ENABLED=true
    export INTERNAL_ROUTES_TOKEN=dev-internal-token
    export TRUST_PROXY_HEADERS=true
    export TLS_ENABLED=false
    # Crank the rate limit way up — every E2E test logs in from the same
    # container IP, and the default 120 req/min limit throttles login flows
    # when the suite runs end-to-end.
    export AUTH_RATE_LIMIT_AUTHENTICATED=10000
    export AUTH_RATE_LIMIT_UNAUTHENTICATED=10000

    # Phase 1: E2E tests.
    # Bring up mongodb, api, and the playwright-specific frontend (frontend-pw),
    # then run the playwright container.  --abort-on-container-exit fires when
    # playwright exits so we capture its exit code directly.
    docker compose up --build \
      --abort-on-container-exit --exit-code-from playwright \
      mongodb api frontend-pw playwright
    pw_status=$?

    if [ "$pw_status" -ne 0 ]; then
      docker compose down --remove-orphans
      exit "$pw_status"
    fi

    # Phase 2: unit + API + Vitest tests.
    # Run only the backend/frontend services and test-runner.  When test-runner
    # exits --abort-on-container-exit fires and we capture its exit code.
    docker compose up \
      --abort-on-container-exit --exit-code-from test-runner \
      mongodb api frontend test-runner
    tr_status=$?

    docker compose down --remove-orphans
    exit "$tr_status"
  fi

  echo "run_tests.sh must be run inside test-runner or with docker compose available"
  exit 1
fi

total=0
passed=0
failed=0

cleanup() {
  status=$?
  trap - EXIT
  MONGO_URI="$TEST_MONGO_URI" node "$BACKEND_DIR/src/scripts/dropTestDatabase.js" || status=1
  exit "$status"
}

reset_transient_test_state() {
  MONGO_URI="$TEST_MONGO_URI" node "$BACKEND_DIR/src/scripts/resetTransientTestState.js"
}

wait_for_api() {
  attempts=0
  until curl -fsS "$API_BASE_URL/api/health" >/dev/null 2>&1; do
    attempts=$((attempts + 1))
    if [ "$attempts" -ge 90 ]; then
      echo "API did not become ready in time"
      return 1
    fi
    sleep 2
  done
}

initialize_internal_admin_token() {
  response_file="/tmp/internal_admin_login.json"
  code=$(curl -sS -o "$response_file" -w "%{http_code}" -X POST "$API_BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -H "X-Device-Id: internal-test-admin-device" \
    -d '{"username":"admin_demo","password":"devpass123456"}')

  if [ "$code" != "200" ]; then
    echo "Failed to initialize internal admin token"
    return 1
  fi

  INTERNAL_ADMIN_TOKEN=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.accessToken)process.exit(1);process.stdout.write(p.accessToken);' "$response_file")
  export INTERNAL_ADMIN_TOKEN
}

trap cleanup EXIT

run_test() {
  name="$1"
  command="$2"
  total=$((total + 1))

  if ! reset_transient_test_state; then
    failed=$((failed + 1))
    echo "FAIL: $name"
    return
  fi

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

if ! initialize_internal_admin_token; then
  exit 1
fi

run_test "API health endpoint returns 200 and status ok" "./backend/tests/api/health_check_test.sh"
run_test "Internal routes require shared token when enabled" "./backend/tests/api/internal_routes_token_required_test.sh"
run_test "Seed data exists and customer account is present" "./backend/tests/api/seed_check_test.sh"
run_test "Unique username constraint is enforced" "./backend/tests/api/unique_username_test.sh"
run_test "Auth login succeeds with seeded account" "./backend/tests/api/auth_login_success_test.sh"
run_test "Auth refresh returns new access token" "./backend/tests/api/auth_refresh_test.sh"
run_test "Auth logout clears session and returns ok" "./backend/tests/api/auth_logout_test.sh"
run_test "Auth missing token returns 401" "./backend/tests/api/auth_missing_token_401_test.sh"
run_test "Auth wrong role returns 403" "./backend/tests/api/auth_wrong_role_403_test.sh"
run_test "Authorization matrix critical route enforcement" "./backend/tests/api/authorization_matrix_test.sh"
run_test "Object-level authorization ownership checks" "./backend/tests/api/ola_access_control_test.sh"
run_test "Validation errors use consistent shape" "./backend/tests/api/validation_error_shape_test.sh"
run_test "Auth rejects wrong password" "./backend/tests/api/auth_wrong_password_test.sh"
run_test "Auth locks account on sixth failed attempt" "./backend/tests/api/auth_lockout_test.sh"
run_test "Auth rate limit returns 429" "./backend/tests/api/auth_rate_limit_test.sh"
run_test "Auth login returns new-device security event once" "./backend/tests/api/auth_new_device_event_test.sh"
run_test "Auth and public responses expose rate-limit headers" "./backend/tests/api/rate_limit_headers_test.sh"
run_test "Admin audit exposes new-device risk metadata" "./backend/tests/api/admin_audit_risk_test.sh"
run_test "Catalog hides unpublished services from public" "./backend/tests/api/catalog_unpublished_visibility_test.sh"
run_test "Catalog publish makes service visible" "./backend/tests/api/catalog_publish_visibility_test.sh"
run_test "Catalog filters services by category and tags" "./backend/tests/api/catalog_filter_query_test.sh"
run_test "Catalog rejects invalid service spec" "./backend/tests/api/catalog_invalid_spec_test.sh"
run_test "Bundle quote uses component defaults" "./backend/tests/api/bundle_quote_defaults_test.sh"
run_test "Quote jurisdictions endpoint returns list for customer" "./backend/tests/api/quote_jurisdictions_test.sh"
run_test "Quote slots endpoint returns available slots for service" "./backend/tests/api/quote_slots_test.sh"
run_test "Quote rejects invalid headcount tools and add-ons" "./backend/tests/api/quote_invalid_spec_validation_test.sh"
run_test "Staff service update via PATCH persists changes" "./backend/tests/api/staff_service_update_test.sh"
run_test "Staff service unpublish removes service from public catalog" "./backend/tests/api/staff_service_unpublish_test.sh"
run_test "Staff bundle patch publish and unpublish lifecycle" "./backend/tests/api/staff_bundle_operations_test.sh"
run_test "Content manage endpoint restricted to staff only" "./backend/tests/api/content_manage_test.sh"
run_test "Content rejects non-content embedded media" "./backend/tests/api/content_invalid_media_purpose_test.sh"
run_test "Structured content body publishes and reads publicly" "./backend/tests/api/content_structured_body_public_test.sh"
run_test "Favorites add/get/delete roundtrip" "./backend/tests/api/favorites_roundtrip_test.sh"
run_test "Favorites and compare requirement regression" "./backend/tests/api/favorites_compare_requirement_test.sh"
run_test "Compare list rejects more than five services" "./backend/tests/api/compare_limit_test.sh"
run_test "Order booking concurrency uses atomic slot decrement" "./backend/tests/api/order_concurrency_test.sh"
run_test "Order cancel transitions order to cancelled state" "./backend/tests/api/order_cancel_test.sh"
run_test "Staff capacity slot create list and delete roundtrip" "./backend/tests/api/staff_orders_slots_test.sh"
run_test "Staff can mark an order as completed" "./backend/tests/api/staff_order_complete_test.sh"
run_test "Media upload rejects oversized file" "./backend/tests/api/media_oversize_upload_test.sh"
run_test "Media MIME and magic-byte validation rejects spoofed files" "./backend/tests/api/media_magic_mime_validation_test.sh"
run_test "Media duplicate upload deduplicates by hash" "./backend/tests/api/media_dedup_test.sh"
run_test "One review per order is enforced" "./backend/tests/api/review_duplicate_per_order_test.sh"
run_test "Review submission window expires after 14 days" "./backend/tests/api/review_window_expired_test.sh"
run_test "Verified approved review appears in service reviews" "./backend/tests/api/review_verified_visibility_test.sh"
run_test "Quarantined review hidden from public list" "./backend/tests/api/review_quarantine_visibility_test.sh"
run_test "Ticket create requires order id" "./backend/tests/api/ticket_missing_order_test.sh"
run_test "Ticket category routes to deterministic team queue" "./backend/tests/api/ticket_category_routing_test.sh"
run_test "Frontend ticket categories route to non-generic queues" "./backend/tests/api/ticket_frontend_category_routing_test.sh"
run_test "Ticket create rejects cross-user media attachments" "./backend/tests/api/ticket_attachment_ownership_test.sh"
run_test "Ticket status transition policy enforces role and state" "./backend/tests/api/ticket_status_transition_policy_test.sh"
run_test "Ticket resolve outcome is immutable" "./backend/tests/api/ticket_resolve_immutable_test.sh"
run_test "Ticket staff actions update pause and legal hold state" "./backend/tests/api/ticket_staff_actions_test.sh"
run_test "Ticket moderator can resolve and legal-hold while customer remains blocked" "./backend/tests/api/ticket_moderator_dispute_actions_test.sh"
run_test "Retention policy prunes closed ticket attachments unless legal hold" "./backend/tests/api/retention_legal_hold_policy_test.sh"
run_test "Ticket SLA fields use business-hours fixture" "./backend/tests/api/ticket_sla_fields_test.sh"
run_test "Scheduled content stays non-public until publish" "./backend/tests/api/content_schedule_visibility_test.sh"
run_test "Scheduled content auto-publishes when due" "./backend/tests/api/content_scheduled_publish_execution_test.sh"
run_test "Content rollback updates published pointer" "./backend/tests/api/content_rollback_test.sh"
run_test "Media delete blocked when referenced" "./backend/tests/api/media_delete_blocked_test.sh"
run_test "Media delete enforces object ownership" "./backend/tests/api/media_delete_ownership_test.sh"
run_test "Media authenticated file get returns file content" "./backend/tests/api/media_file_get_test.sh"
run_test "Inbox hides moderator-only message from customer" "./backend/tests/api/inbox_role_visibility_test.sh"
run_test "Inbox mark-read persists per user" "./backend/tests/api/inbox_mark_read_test.sh"
run_test "Content public read returns published entries" "./backend/tests/api/content_public_read_test.sh"
run_test "Internal seed-check rejects requests when routes disabled" "./backend/tests/api/internal_seed_check_off_test.sh"
run_test "Moderation list returns pending items for moderators" "./backend/tests/api/moderation_list_test.sh"
run_test "Moderator can approve a quarantined review" "./backend/tests/api/moderation_review_approve_test.sh"
run_test "Moderator can reject a quarantined review" "./backend/tests/api/moderation_review_reject_test.sh"
run_test "Orders list filters by customer and staff visibility" "./backend/tests/api/orders_list_test.sh"
run_test "Question-and-answer flow visibility across roles" "./backend/tests/api/qa_flow_visibility_test.sh"
run_test "Tickets list returns customer's tickets" "./backend/tests/api/tickets_list_test.sh"
run_test "Search returns only published entities" "./backend/tests/api/search_published_only_test.sh"
run_test "Search cleanup script smoke test" "./backend/tests/api/search_cleanup_smoke_test.sh"
run_test "Retention cleanup script smoke test" "./backend/tests/api/retention_cleanup_smoke_test.sh"
run_test "Customer views are masked while staff views full contact" "./backend/tests/api/masking_profile_order_test.sh"
run_test "Admin blacklist endpoint blocks forwarded IP" "./backend/tests/api/admin_blacklist_upsert_test.sh"
run_test "Staff inbox messages respect role visibility" "./backend/tests/api/inbox_staff_visibility_test.sh"
run_test "Blacklisted IP cannot access API" "./backend/tests/api/blacklist_ip_test.sh"

# https_health_smoke_test.sh expects an nginx/TLS proxy in front of the API
# (API_HTTPS_BASE_URL, default https://proxy). The default test topology has
# TLS_ENABLED=false, so run the smoke test only when a proxy URL is provided.
if [ -n "$API_HTTPS_BASE_URL" ]; then
  run_test "HTTPS health smoke against proxy" "./backend/tests/api/https_health_smoke_test.sh"
fi
run_test "Backend node unit and service tests" "NODE_ENV=test npm --prefix ./backend run test:unit"
run_test "Frontend Vitest suite with coverage" "npm --prefix ./frontend run test:coverage"

echo "TOTAL: $total, PASSED: $passed, FAILED: $failed"

if [ "$failed" -eq 0 ]; then
  exit 0
fi

exit 1
