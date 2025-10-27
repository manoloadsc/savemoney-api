FROM node:22-slim AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY tsconfig.json ./
COPY tsup.config.ts ./
COPY prisma ./prisma
RUN npx prisma generate         

COPY src ./src
COPY public ./public
COPY views ./views
COPY data ./data

RUN npm run build
RUN test -f dist/server.cjs || (echo '❌ dist/server.cjs não encontrado. Conteúdo de dist:' && ls -la dist && exit 1)

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000                   

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/generated/prisma ./generated/prisma
RUN npx prisma generate

COPY --from=builder /app/dist   ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/views  ./views
COPY --from=builder /app/data   ./data

EXPOSE 4000
CMD ["sh","-lc","npx prisma migrate deploy && node dist/server.cjs"]