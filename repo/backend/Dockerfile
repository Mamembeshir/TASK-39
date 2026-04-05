FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache curl openssl

COPY backend/package*.json ./backend/
RUN npm --prefix ./backend ci --omit=dev

COPY backend ./backend

EXPOSE 4000

CMD ["node", "backend/src/index.js"]
