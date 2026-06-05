# ── Build Stage ──
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared/ ./packages/shared/
COPY apps/api/ ./apps/api/

# Build
RUN cd packages/shared && pnpm build
RUN cd apps/api && pnpm build

# Prune dev dependencies
RUN pnpm prune --prod

# ── Runtime Stage ──
FROM node:20-alpine AS runtime

RUN apk add --no-cache tini
WORKDIR /app

# Copy built artifacts + production dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules

ENV NODE_ENV=production
EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/api/dist/main.js"]
