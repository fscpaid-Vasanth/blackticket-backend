# ── Stage 1: Build ──────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy prisma schema BEFORE npm ci so postinstall (prisma generate) finds it
COPY prisma ./prisma

# Install ALL dependencies (dev + prod) for the build
RUN npm ci

# Copy source code
COPY . .

# Compile TypeScript → dist/
RUN npm run build

# ── Stage 2: Production Runtime ─────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

# Copy node_modules (already includes Prisma client generated in builder stage)
COPY --from=builder /app/node_modules ./node_modules

# Copy prisma schema (needed for runtime introspection)
COPY --from=builder /app/prisma ./prisma

# Copy package.json (for metadata)
COPY package*.json ./

EXPOSE 3000

CMD ["node", "dist/main"]
