# ---- Base Stage ----
FROM oven/bun:1-alpine AS base
WORKDIR /app

# Install dependencies for Next.js and sharp (image optimization)
RUN apk add --no-cache libc6-compat=1.1.0-r4

# ---- Dependencies Stage ----
FROM base AS deps

# Copy package files
COPY package.json bun.lock* ./

# Install dependencies
RUN bun install --frozen-lockfile

# ---- Builder Stage ----
FROM base AS builder

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy all source files
COPY . .

# Set build-time environment variables
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Disable Sentry during build if no auth token
ARG SENTRY_AUTH_TOKEN
ENV SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN}

# Generate any required files (e.g., GraphQL types)
RUN bun run gen || true

# Build the Next.js application
RUN bun run build

# ---- Production Stage ----
FROM base AS runner

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
  adduser --system --uid 1001 nextjs

# Copy public assets
COPY --from=builder /app/public ./public

# Set the correct permissions for prerender cache
RUN mkdir .next && chown nextjs:nodejs .next

# Copy the Next.js build output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Switch to non-root user
USER nextjs

# Expose the application port
EXPOSE 3000

# Set the port environment variable
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD bun --version > /dev/null || exit 1

# Start the Next.js server
CMD ["node", "server.js"]
