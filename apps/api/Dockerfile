# Azalas API — production
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/
COPY packages/shared-types/package.json packages/shared-types/
RUN npm install --workspace=apps/api --workspace=packages/db --workspace=packages/shared-types --no-audit --no-fund
COPY tsconfig.base.json ./
COPY packages/shared-types packages/shared-types
COPY packages/db/migrations ./packages/db/migrations
COPY packages/db/schema.prisma ./packages/db/schema.prisma
COPY apps/api ./apps/api
RUN npx prisma generate --schema packages/db/schema.prisma
RUN npm run build --workspace=apps/api
RUN npm prune --omit=dev --workspace=apps/api --workspace=packages/db || true

FROM node:22-slim AS run
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/packages ./packages
COPY --from=build /app/package.json ./package.json
COPY docker/api-start.sh ./docker/api-start.sh
RUN chmod +x ./docker/api-start.sh
EXPOSE 8010
CMD ["./docker/api-start.sh"]
