FROM node:24-bookworm-slim

WORKDIR /app
COPY package.json server.mjs ./
COPY lib/ ./lib/
COPY data/ ./data/
COPY public/ ./public/

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    DATA_FILE=/data/game.sqlite \
    COOKIE_SECURE=1

EXPOSE 3000
CMD ["node", "server.mjs"]
