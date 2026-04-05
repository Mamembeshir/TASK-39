#!/bin/sh

base_url="${API_BASE_URL:-http://api:4000}"
internal_token="${INTERNAL_ROUTES_TOKEN:-dev-internal-token}"
internal_admin_token="${INTERNAL_ADMIN_TOKEN:-}"

customer_cookie_file=/tmp/ticket_attachment_owner_customer.cookies
customer_login_code=$(curl -sS -c "$customer_cookie_file" -o /tmp/ticket_attachment_owner_customer_login.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: ticket-attachment-customer-device" \
  -d '{"username":"customer_demo","password":"devpass123456"}')

username_b="ticket_attach_user_$(date +%s)"
password_b="ticket-attach-pass-123"

register_cookie_file=/tmp/ticket_attachment_owner_register_b.cookies
register_b_code=$(curl -sS -c "$register_cookie_file" -o /tmp/ticket_attachment_owner_register_b.json -w "%{http_code}" -X POST "$base_url/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$username_b\",\"password\":\"$password_b\"}")

login_b_cookie_file=/tmp/ticket_attachment_owner_login_b.cookies
login_b_code=$(curl -sS -c "$login_b_cookie_file" -o /tmp/ticket_attachment_owner_login_b.json -w "%{http_code}" -X POST "$base_url/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: ticket-attachment-b-device" \
  -d "{\"username\":\"$username_b\",\"password\":\"$password_b\"}")

fixture_code=$(curl -sS -o /tmp/ticket_attachment_owner_fixture.json -w "%{http_code}" -X POST "$base_url/api/internal/test-fixtures/completed-order" \
  -H "X-Internal-Token: $internal_token" \
  -H "Authorization: Bearer $internal_admin_token")

if [ "$customer_login_code" != "200" ] || [ "$register_b_code" != "201" ] || [ "$login_b_code" != "200" ] || [ "$fixture_code" != "201" ]; then
  exit 1
fi

order_id=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.orderId);' /tmp/ticket_attachment_owner_fixture.json)

node -e '
const fs=require("fs");
const bytes=[
  0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,
  0x00,0x00,0x00,0x0d,0x49,0x48,0x44,0x52,
  0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x01,
  0x08,0x02,0x00,0x00,0x00,0x90,0x77,0x53,
  0xde,0x00,0x00,0x00,0x0a,0x49,0x44,0x41,
  0x54,0x78,0x9c,0x63,0x60,0x00,0x00,0x00,
  0x02,0x00,0x01,0xe5,0x27,0xd4,0xa2,0x00,
  0x00,0x00,0x00,0x49,0x45,0x4e,0x44,0xae,
  0x42,0x60,0x82
];
fs.writeFileSync("/tmp/ticket-attachment-owner.png", Buffer.from(bytes));
'

upload_b_code=$(curl -sS -o /tmp/ticket_attachment_owner_upload_b.json -w "%{http_code}" -X POST "$base_url/api/media" \
  -b "$login_b_cookie_file" \
  -F "purpose=review" \
  -F "files=@/tmp/ticket-attachment-owner.png;type=image/png")

if [ "$upload_b_code" != "201" ]; then
  exit 1
fi

media_id_b=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));const m=(p.media||[])[0];if(!m||!m.mediaId)process.exit(1);process.stdout.write(m.mediaId);' /tmp/ticket_attachment_owner_upload_b.json)

ticket_create_code=$(curl -sS -o /tmp/ticket_attachment_owner_create.json -w "%{http_code}" -X POST "$base_url/api/tickets" \
  -b "$customer_cookie_file" \
  -H "Content-Type: application/json" \
  -d "{\"orderId\":\"$order_id\",\"category\":\"billing\",\"description\":\"ownership check\",\"attachmentIds\":[\"$media_id_b\"]}")

if [ "$ticket_create_code" != "403" ]; then
  exit 1
fi

node -e '
const fs=require("fs");
const payload=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
process.exit(payload && payload.code === "MEDIA_FORBIDDEN" ? 0 : 1);
' /tmp/ticket_attachment_owner_create.json
