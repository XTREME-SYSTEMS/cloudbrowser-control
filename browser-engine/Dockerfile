FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    libgbm1 libasound2 libpango-1.0-0 libcairo2 libatspi2.0-0

WORKDIR /app

# Core deps — fast, cached
COPY package.json ./
RUN npm install --production --omit=optional

# Playwright Chromium
RUN npx playwright install chromium

# @xenova/transformers is ~300MB — install separately, fault-tolerant
# If it fails, engine still starts (audio captcha path will fail gracefully)
RUN npm install @xenova/transformers@^2.17.1 --no-save || echo "WARN: @xenova/transformers install failed — audio STT will be unavailable"

# Copy all engine source files
COPY server.js ./
COPY session-manager.js ./
COPY captcha-self-solver.js ./
COPY fingerprint-randomizer.js ./
COPY human-behavior.js ./
COPY stt-whisper.js ./
COPY self-solvers/ ./self-solvers/

ENV PORT=8080
ENV MAX_SESSIONS=10
ENV DEFAULT_TIMEOUT=30000
ENV SESSION_TTL_MS=300000

EXPOSE 8080
CMD ["node", "server.js"]

