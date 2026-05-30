# ── Stage 1: Build ──────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production=false

COPY . .
RUN npm run build

# ── Stage 2: Production Runtime ─────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Copy only production dependencies and compiled output
COPY --from=builder /app/package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Generate Prisma client inside the production image
RUN npx prisma generate

EXPOSE 3000

CMD ["node", "dist/main"]
