FROM mcr.microsoft.com/playwright:v1.43.0-jammy

WORKDIR /workspace/e2e

COPY frontend/tests/e2e/package*.json ./
# No lockfile is shipped with the E2E harness; use a non-frozen install so the
# image can build from a fresh clone.
RUN npm install --no-audit --no-fund

COPY frontend/tests/e2e ./

CMD ["npx", "playwright", "test", "--reporter=line"]
