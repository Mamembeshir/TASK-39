#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"

login_code=$(curl -sS -o /tmp/content_schedule_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: content-schedule-device" \
  -d '{"username":"admin_demo","password":"devpass123456"}')

if [ "$login_code" != "200" ]; then
  exit 1
fi

token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.accessToken);' /tmp/content_schedule_login.json)
slug="schedule-visibility-$(date +%s)"
future_publish="2030-01-01T12:00:00.000Z"

create_code=$(curl -sS -o /tmp/content_schedule_create.json -w "%{http_code}" -X POST "$base_url/api/content" \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d "{\"slug\":\"$slug\",\"title\":\"Scheduled article\",\"body\":\"draft body\",\"mediaIds\":[]}")

if [ "$create_code" != "201" ]; then
  exit 1
fi

content_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.id);' /tmp/content_schedule_create.json)
version_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.versionId);' /tmp/content_schedule_create.json)

schedule_code=$(curl -sS -o /tmp/content_schedule_schedule.json -w "%{http_code}" -X POST "$base_url/api/content/$content_id/schedule" \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d "{\"publishAt\":\"$future_publish\",\"versionId\":\"$version_id\"}")

versions_code=$(curl -sS -o /tmp/content_schedule_versions.json -w "%{http_code}" "$base_url/api/content/$content_id/versions" \
  -H "Authorization: Bearer $token")

public_code=$(curl -sS -o /tmp/content_schedule_public.json -w "%{http_code}" "$base_url/api/content/$content_id")

if [ "$schedule_code" != "200" ] || [ "$versions_code" != "200" ] || [ "$public_code" != "404" ]; then
  exit 1
fi

node -e '
const fs=require("fs");
const scheduled=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const versions=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
const publicPayload=JSON.parse(fs.readFileSync(process.argv[3],"utf8"));
const ok = scheduled.scheduledVersionId === process.argv[4]
  && versions.scheduledVersionId === process.argv[4]
  && String(versions.scheduledPublishAt).startsWith("2030-01-01T12:00:00.000Z")
  && publicPayload.code === "CONTENT_NOT_FOUND";
process.exit(ok ? 0 : 1);
' /tmp/content_schedule_schedule.json /tmp/content_schedule_versions.json /tmp/content_schedule_public.json "$version_id"
