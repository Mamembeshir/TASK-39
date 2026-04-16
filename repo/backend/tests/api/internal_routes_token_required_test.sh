#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"
internal_token="${INTERNAL_ROUTES_TOKEN:-dev-internal-token}"
internal_admin_token="${INTERNAL_ADMIN_TOKEN:-}"

without_token_code=$(curl -sS -o /tmp/internal_token_required_denied.json -w "%{http_code}" "$base_url/api/internal/seed-check" \
  -H "Authorization: Bearer $internal_admin_token")
with_token_code=$(curl -sS -o /tmp/internal_token_required_allowed.json -w "%{http_code}" "$base_url/api/internal/seed-check" \
  -H "X-Internal-Token: $internal_token" \
  -H "Authorization: Bearer $internal_admin_token")

audit_code=$(curl -sS -o /tmp/internal_token_required_audit.json -w "%{http_code}" "$base_url/api/admin/audit" \
  -H "Authorization: Bearer $internal_admin_token")

if [ "$without_token_code" != "403" ] || [ "$with_token_code" != "200" ] || [ "$audit_code" != "200" ]; then
  exit 1
fi

node -e '
const fs=require("fs");
const denied=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const allowed=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
const audit=JSON.parse(fs.readFileSync(process.argv[3],"utf8"));
const hasAudit=(audit||[]).some((entry) => entry.action === "internal.seed_check");
const ok = denied && denied.code === "FORBIDDEN"
  && allowed && allowed.counts && typeof allowed.counts.users === "number"
  && hasAudit;
process.exit(ok ? 0 : 1);
' /tmp/internal_token_required_denied.json /tmp/internal_token_required_allowed.json /tmp/internal_token_required_audit.json
