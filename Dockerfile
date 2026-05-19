FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@11.1.2 --activate
WORKDIR /app

FROM base AS builder
ENV CI=true
ENV NEXT_TELEMETRY_DISABLED=1
ENV PAYLOAD_SECRET=build-placeholder-secret-minimum-32-chars
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 cms

COPY --from=builder /app/public ./public
RUN mkdir .next && chown cms:nodejs .next
COPY --from=builder --chown=cms:nodejs /app/.next/standalone ./
COPY --from=builder --chown=cms:nodejs /app/.next/static ./.next/static
COPY --chown=cms:nodejs scripts/cloudrun/start.sh ./start.sh
RUN chmod +x ./start.sh

USER cms
EXPOSE 3000

CMD ["./start.sh"]
