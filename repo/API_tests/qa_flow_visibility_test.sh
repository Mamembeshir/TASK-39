#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"
service_id="65f000000000000000000101"
qa_username="qa_flow_$(date +%s)"
qa_password="qa-flow-password-123"

register_code=$(curl -sS -o /tmp/qa_flow_register.json -w "%{http_code}" -X POST "$base_url/api/auth/register" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: qa-flow-register-device" \
  -d "{\"username\":\"$qa_username\",\"password\":\"$qa_password\"}")

customer_login_code=$(curl -sS -o /tmp/qa_flow_customer_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: qa-flow-customer-device" \
  -d "{\"username\":\"$qa_username\",\"password\":\"$qa_password\"}")

moderator_login_code=$(curl -sS -o /tmp/qa_flow_moderator_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: qa-flow-moderator-device" \
  -d '{"username":"moderator_demo","password":"devpass123456"}')

if [ "$register_code" != "201" ] || [ "$customer_login_code" != "200" ] || [ "$moderator_login_code" != "200" ]; then
  exit 1
fi

customer_token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.accessToken);' /tmp/qa_flow_customer_login.json)
moderator_token=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.accessToken);' /tmp/qa_flow_moderator_login.json)

q1="How does QA flow publish? $(date +%s)"
q2="How does QA flow reject? $(date +%s)"

create_q1_code=$(curl -sS -o /tmp/qa_flow_create_q1.json -w "%{http_code}" -X POST "$base_url/api/services/$service_id/questions" \
  -H "Authorization: Bearer $customer_token" \
  -H "Content-Type: application/json" \
  -d "{\"question\":\"$q1\"}")

create_q2_code=$(curl -sS -o /tmp/qa_flow_create_q2.json -w "%{http_code}" -X POST "$base_url/api/services/$service_id/questions" \
  -H "Authorization: Bearer $customer_token" \
  -H "Content-Type: application/json" \
  -d "{\"question\":\"$q2\"}")

if [ "$create_q1_code" != "201" ] || [ "$create_q2_code" != "201" ]; then
  exit 1
fi

q1_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(p.status!=="pending_moderation")process.exit(1);process.stdout.write(p.id);' /tmp/qa_flow_create_q1.json)
q2_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(p.status!=="pending_moderation")process.exit(1);process.stdout.write(p.id);' /tmp/qa_flow_create_q2.json)

pending_code=$(curl -sS -o /tmp/qa_flow_pending.json -w "%{http_code}" "$base_url/api/moderation/questions" \
  -H "Authorization: Bearer $moderator_token")

publish_code=$(curl -sS -o /tmp/qa_flow_publish.json -w "%{http_code}" -X POST "$base_url/api/moderation/questions/$q1_id/publish" \
  -H "Authorization: Bearer $moderator_token" \
  -H "Content-Type: application/json" \
  -d '{"answer":"Published answer"}')

reject_code=$(curl -sS -o /tmp/qa_flow_reject.json -w "%{http_code}" -X POST "$base_url/api/moderation/questions/$q2_id/reject" \
  -H "Authorization: Bearer $moderator_token")

public_code=$(curl -sS -o /tmp/qa_flow_public.json -w "%{http_code}" "$base_url/api/services/$service_id/questions")

if [ "$pending_code" != "200" ] || [ "$publish_code" != "200" ] || [ "$reject_code" != "200" ] || [ "$public_code" != "200" ]; then
  exit 1
fi

node -e '
const fs=require("fs");
const pending=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const pub=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
const q1=process.argv[3];
const q2=process.argv[4];
const pendingIds=(pending.questions||[]).map((q)=>q.id);
const publicQuestions=pub.questions||[];
const publishedVisible=publicQuestions.some((q)=>q.id===q1 && q.answer==="Published answer");
const rejectedHidden=publicQuestions.every((q)=>q.id!==q2);
const pendingSawNew=pendingIds.includes(q1) || pendingIds.includes(q2);
process.exit(pendingSawNew && publishedVisible && rejectedHidden ? 0 : 1);
' /tmp/qa_flow_pending.json /tmp/qa_flow_public.json "$q1_id" "$q2_id"
