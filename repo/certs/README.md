# Local TLS Certificates

Do not commit private keys or generated certificate files to version control.

Generate local development certs on your machine:

```bash
mkdir -p certs
openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 365 \
  -keyout certs/localhost.key \
  -out certs/localhost.crt \
  -subj "/CN=localhost"
```

Files expected at runtime:

- `certs/localhost.key`
- `certs/localhost.crt`

These files are intentionally gitignored for security.
