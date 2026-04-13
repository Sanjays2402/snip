# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json ./
COPY src/ ./src/
COPY drizzle.config.ts ./

RUN npm run build

# Stage 2: Production
FROM node:22-alpine AS runner

WORKDIR /app

RUN addgroup --system --gid 1001 snip && \
    adduser --system --uid 1001 snip

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle.config.ts ./
COPY drizzle/ ./drizzle/

USER snip

EXPOSE 3000

CMD ["node", "dist/index.js"]
