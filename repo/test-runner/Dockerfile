FROM node:20-alpine

WORKDIR /workspace

RUN apk add --no-cache curl

COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

RUN npm --prefix ./backend ci && npm --prefix ./frontend ci

COPY backend ./backend
COPY frontend ./frontend
COPY API_tests ./API_tests
COPY unit_tests ./unit_tests
COPY run_tests.sh ./run_tests.sh

RUN chmod +x ./run_tests.sh ./API_tests/*.sh ./unit_tests/*.sh

CMD ["./run_tests.sh"]
