FROM node:20-alpine

WORKDIR /workspace

ENV BACKEND_DIR=/workspace/backend
ENV FRONTEND_DIR=/workspace/frontend
ENV NODE_PATH=/workspace/backend/node_modules
ENV RUN_TESTS_IN_CONTAINER=1

RUN apk add --no-cache curl

COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install backend deps (prod only) and all frontend deps (including test tooling)
RUN npm --prefix ./backend ci --omit=dev && npm --prefix ./frontend ci

COPY backend ./backend
COPY frontend ./frontend
COPY run_tests.sh ./run_tests.sh

# API shell scripts now live inside backend/tests/api (restructured from the
# former top-level API_tests/ directory).
RUN chmod +x ./run_tests.sh ./backend/tests/api/*.sh

CMD ["./run_tests.sh"]
