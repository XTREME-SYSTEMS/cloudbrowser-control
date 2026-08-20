FROM node:20-slim

ENV NODE_ENV=production \
    HOME=/home/engine \
    XDG_CACHE_HOME=/tmp/.cache \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN useradd --create-home --uid 10001 --shell /usr/sbin/nologin engine
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev --ignore-scripts && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
      ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 \
      libcups2 libdbus-1-3 libdrm2 libgbm1 libglib2.0-0 libgtk-3-0 \
      libnspr4 libnss3 libpango-1.0-0 libx11-6 libxcb1 libxcomposite1 \
      libxdamage1 libxext6 libxfixes3 libxkbcommon0 libxrandr2 xdg-utils && \
    rm -rf /var/lib/apt/lists/* && \
    mkdir -p /ms-playwright /tmp/videos /tmp/uploads /data/extensions /tmp/.cache && \
    npx playwright install chromium

COPY . .
RUN chown -R engine:engine /app /home/engine /ms-playwright /tmp/videos /tmp/uploads /data /tmp/.cache && \
    chmod -R a+rX /ms-playwright

USER engine
EXPOSE 8080
CMD ["node", "server.js"]
