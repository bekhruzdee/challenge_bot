# ── Stage 1: Build ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# ── Stage 2: Production ─────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Schema must be present before install so the postinstall (prisma generate) succeeds
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/dist ./dist
COPY prisma.config.ts ./

EXPOSE 3000

# Run pending migrations then start the bot
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/src/main"]
