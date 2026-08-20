FROM node:20-slim

# ═══════════════════════════════════════════════
# V1.1 AM-5: Hardened container isolation
# Runtime hardening flags (apply via Railway service config / docker run):
#   --read-only --tmpfs /tmp --tmpfs /tmp/videos --tmpfs /tmp/profiles \
#   --cap-drop=ALL --security-opt=no-new-privileges \
#   --memory=2g --cpus=2 --pids-limit=256
# ═══════════════════════════════════════════════

RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    libgbm1 libasound2 libpango-1.0-0 libcairo2 libatspi2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Non-root user
RUN groupadd -r engine && useradd -r -g engine -d /home/engine -s /sbin/nologin engine

WORKDIR /app
COPY package.json ./
RUN npm install --production
RUN npx playwright install chromium

COPY server.js ./

# Ephemeral writable dirs (tmpfs at runtime); extension base is admin-controlled
RUN mkdir -p /tmp/videos /tmp/profiles /data/extensions /home/engine && \
    chown -R engine:engine /app /tmp /data /home/engine

ENV PORT=8080
ENV MAX_SESSIONS=10
ENV DEFAULT_TIMEOUT=30000
ENV SESSION_TTL_MS=300000
ENV VIDEO_DIR=/tmp/videos
ENV PROFILE_DIR=/tmp/profiles
ENV EXTENSION_DIR=/data/extensions
ENV ALLOW_CDP=false

USER engine

EXPOSE 8080
CMD ["node", "--no-warnings", "server.js"]