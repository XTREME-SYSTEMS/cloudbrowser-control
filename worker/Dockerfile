FROM node:24-alpine

# Build context is the repository root — same layout as the API, for the same
# reason: worker.js imports ../shared/db.js, which only exists if shared/ is
# copied alongside it.
WORKDIR /srv
COPY worker/package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund

COPY worker/ ./worker/
COPY shared/ ./shared/

ENV NODE_ENV=production

WORKDIR /srv/worker
USER node

CMD ["node", "worker.js"]
