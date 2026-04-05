#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"

login_code=$(curl -sS -o /tmp/content_scheduled_publish_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: content-scheduled-publish-device" \
  -d '{"username":"admin_demo","password":"devpass123456"}')

if [ "$login_code" != "200" ]; then
  exit 1
fi

token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.accessToken) process.exit(1);process.stdout.write(p.accessToken);' /tmp/content_scheduled_publish_login.json)
slug="scheduled-publish-$(date +%s)"
publish_at=$(node -e 'process.stdout.write(new Date(Date.now()+2000).toISOString())')

create_code=$(curl -sS -o /tmp/content_scheduled_publish_create.json -w "%{http_code}" -X POST "$base_url/api/content" \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d "{\"slug\":\"$slug\",\"title\":\"Scheduled publish title\",\"body\":\"Scheduled publish body\",\"mediaIds\":[]}")

if [ "$create_code" != "201" ]; then
  exit 1
fi

content_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.id)process.exit(1);process.stdout.write(p.id);' /tmp/content_scheduled_publish_create.json)
version_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!p.versionId)process.exit(1);process.stdout.write(p.versionId);' /tmp/content_scheduled_publish_create.json)

schedule_code=$(curl -sS -o /tmp/content_scheduled_publish_schedule.json -w "%{http_code}" -X POST "$base_url/api/content/$content_id/schedule" \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d "{\"publishAt\":\"$publish_at\",\"versionId\":\"$version_id\"}")

if [ "$schedule_code" != "200" ]; then
  exit 1
fi

public_code=""
attempt=0
while [ "$attempt" -lt 25 ]; do
  public_code=$(curl -sS -o /tmp/content_scheduled_publish_public.json -w "%{http_code}" "$base_url/api/content/$content_id")
  if [ "$public_code" = "200" ]; then
    break
  fi
  sleep 1
  attempt=$((attempt + 1))
done

if [ "$public_code" != "200" ]; then
  exit 1
fi

versions_code=$(curl -sS -o /tmp/content_scheduled_publish_versions.json -w "%{http_code}" "$base_url/api/content/$content_id/versions" \
  -H "Authorization: Bearer $token")

if [ "$versions_code" != "200" ]; then
  exit 1
fi

node -e '
const fs=require("fs");
const publicPayload=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const versionsPayload=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
const expectedVersionId=process.argv[3];
const ok = publicPayload.title === "Scheduled publish title"
  && publicPayload.body === "Scheduled publish body"
  && versionsPayload.status === "published"
  && versionsPayload.publishedVersionId === expectedVersionId
  && versionsPayload.scheduledVersionId === null
  && versionsPayload.scheduledPublishAt === null;
process.exit(ok ? 0 : 1);
' /tmp/content_scheduled_publish_public.json /tmp/content_scheduled_publish_versions.json "$version_id"
