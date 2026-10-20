FROM node:24-alpine

WORKDIR /srv

# Dependencies first for layer caching. No lockfile is committed yet, so the
# image installs from the range-pinned manifest (see docs/portable/DEPLOYMENT.md
# for the lockfile follow-up).
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY . .

ENV NODE_ENV=production
ENV API_PORT=4000
EXPOSE 4000

USER node

CMD ["node", "server.js"]