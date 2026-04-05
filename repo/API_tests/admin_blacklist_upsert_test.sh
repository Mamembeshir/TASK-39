#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"
blocked_ip="203.0.113.88"

admin_login_code=$(curl -sS -o /tmp/admin_blacklist_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: admin-blacklist-device" \
  -d '{"username":"admin_demo","password":"devpass123456"}')

if [ "$admin_login_code" != "200" ]; then
  exit 1
fi

admin_token=$(node -e 'const fs=require("fs"); const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(p.accessToken);' /tmp/admin_blacklist_login.json)

upsert_code=$(curl -sS -o /tmp/admin_blacklist_upsert.json -w "%{http_code}" -X POST "$base_url/api/admin/blacklist" \
  -H "Authorization: Bearer $admin_token" \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"ip\",\"value\":\"$blocked_ip\",\"active\":true}")

list_code=$(curl -sS -o /tmp/admin_blacklist_list.json -w "%{http_code}" "$base_url/api/admin/blacklist" \
  -H "Authorization: Bearer $admin_token")

audit_code=$(curl -sS -o /tmp/admin_blacklist_audit.json -w "%{http_code}" "$base_url/api/admin/audit" \
  -H "Authorization: Bearer $admin_token")

blocked_code=$(curl -sS -o /tmp/admin_blacklist_health.json -w "%{http_code}" "$base_url/api/health" \
  -H "X-Forwarded-For: $blocked_ip")

if [ "$upsert_code" != "200" ] || [ "$list_code" != "200" ] || [ "$audit_code" != "200" ] || [ "$blocked_code" != "403" ]; then
  exit 1
fi

node -e '
const fs=require("fs");
const items=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const blocked=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
const audit=JSON.parse(fs.readFileSync(process.argv[3],"utf8"));
const hasEntry=(items||[]).some((item) => item.type === "ip" && item.value === process.argv[4] && item.active === true);
const hasAudit=(audit||[]).some((entry) => entry.action === "admin.blacklist.upsert" && entry.metadata && entry.metadata.details && entry.metadata.details.value === process.argv[4]);
process.exit(hasEntry && blocked.code === "BLACKLISTED" && hasAudit ? 0 : 1);
' /tmp/admin_blacklist_list.json /tmp/admin_blacklist_health.json /tmp/admin_blacklist_audit.json "$blocked_ip"
