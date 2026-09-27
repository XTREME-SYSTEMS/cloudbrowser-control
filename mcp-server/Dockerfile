FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
RUN npm audit --omit=dev --audit-level=high
COPY src ./src
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "src/server.mjs"]
