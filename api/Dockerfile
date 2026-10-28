FROM node:24-alpine

# Build context is the repository root: the API imports ../shared/db.js, so the
# image lays out /srv/api/server.js beside /srv/shared/, with dependencies
# installed at /srv where both of them can resolve them. Building from api/ alone
# left /shared absent and the container died on ERR_MODULE_NOT_FOUND.
WORKDIR /srv
COPY api/package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund

COPY api/ ./api/
COPY shared/ ./shared/

ENV NODE_ENV=production
ENV API_PORT=4000
EXPOSE 4000

WORKDIR /srv/api
USER node

CMD ["node", "server.js"]
