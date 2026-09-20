# Azalas Web — production (standalone)
FROM node:22-slim AS build
WORKDIR /app
ARG NEXT_PUBLIC_API_URL=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY package.json package-lock.json* ./
COPY apps/web/package.json apps/web/
COPY packages/shared-types/package.json packages/shared-types/
RUN npm install --workspace=apps/web --workspace=packages/shared-types --no-audit --no-fund
COPY tsconfig.base.json ./
COPY packages/shared-types packages/shared-types
COPY apps/web ./apps/web
RUN npm run build --workspace=apps/web

FROM node:22-slim AS run
ENV NODE_ENV=production
ENV PORT=8011
WORKDIR /app
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
EXPOSE 8011
CMD ["node", "apps/web/server.js"]
