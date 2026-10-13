# Stage 1: Builder
FROM node:20.11-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++ vips-dev
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Stage 2: Runtime
FROM node:20.11-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache vips tini && addgroup -S pgbooking && adduser -S pgbooking -G pgbooking
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=builder /app/dist ./dist
COPY --chown=pgbooking:pgbooking .env.example ./
RUN mkdir -p keys && chown pgbooking:pgbooking keys
USER pgbooking
EXPOSE 3000
ENV NODE_ENV=production PORT=3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 CMD wget -qO- http://localhost:3000/health || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/server.js"]
