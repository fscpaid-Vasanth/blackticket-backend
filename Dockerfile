# ── Stage 1: Build ──────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first
COPY package*.json ./

# Copy prisma schema BEFORE npm ci so postinstall (prisma generate) can find it
COPY prisma ./prisma

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy rest of source code
COPY . .

# Compile TypeScript → dist/
RUN npm run build

# ── Stage 2: Production Runtime ─────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma

# Install production dependencies only
RUN npm ci --omit=dev

# Regenerate Prisma client in production image
RUN npx prisma generate

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/main"]
