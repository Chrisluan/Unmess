FROM node:24-alpine AS deps
WORKDIR /app
RUN apk add --no-cache git
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

FROM node:24-alpine AS runtime
ENV NODE_ENV=production \
    PORT=8090 \
    GATEWAY_DATA_DIR=/data \
    GATEWAY_MEDIA_DIR=/media
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json openapi.yaml ./
COPY src ./src
RUN mkdir -p /data /media && chown -R node:node /data /media
USER node
EXPOSE 8090
VOLUME ["/data", "/media"]
HEALTHCHECK --interval=15s --timeout=3s --start-period=15s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8090/health/live || exit 1
STOPSIGNAL SIGTERM
ENTRYPOINT ["node", "src/index.ts"]
