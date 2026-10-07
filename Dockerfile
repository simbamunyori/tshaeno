# syntax=docker/dockerfile:1
# One image runs the web app (default), the worker (command: worker) and
# applies migrations (command: migrate). See docker-compose.yml.
FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# Only what the worker and the Prisma CLI need at run time.
FROM base AS prod-deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev \
  && npm install --no-save "prisma@$(node -p "require('./package-lock.json').packages['node_modules/prisma'].version")" \
  && npx prisma generate

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build
# The worker, bundled with its own code; packages come from node_modules.
RUN npx esbuild src/worker.ts --bundle --platform=node --format=esm --target=node22 --packages=external \
  --tsconfig=tsconfig.json --outfile=dist/worker.mjs --log-level=warning

FROM base AS runner
ARG APP_VERSION=dev
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 APP_VERSION=$APP_VERSION
RUN groupadd --system tshaeno && useradd --system --gid tshaeno tshaeno
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build --chown=tshaeno:tshaeno /app/.next/standalone ./
COPY --from=build --chown=tshaeno:tshaeno /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/dist/worker.mjs ./worker.mjs
COPY docker/entrypoint.sh /usr/local/bin/entrypoint
USER tshaeno
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["entrypoint"]
CMD ["web"]
