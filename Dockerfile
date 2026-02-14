# ============================================================================
# Stage 1: Install dependencies
# ============================================================================
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --only=production=false

# ============================================================================
# Stage 2: Build the application
# ============================================================================
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Disable Next.js telemetry
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ============================================================================
# Stage 3: Production runner (minimal image)
# ============================================================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Constrain Node.js heap to 448MB — headroom for 15k+ invoices/month
ENV NODE_OPTIONS="--max-old-space-size=448 --enable-source-maps"

# Don't run as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built standalone output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
