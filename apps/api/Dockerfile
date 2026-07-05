# NOT YET INTEGRATION-TESTED — written to spec, verify once Docker is available.
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/shared-types ./packages/shared-types
COPY apps/api ./apps/api
RUN pnpm install --frozen-lockfile --filter @openstage/api... \
  && pnpm --filter @openstage/shared-types build \
  && pnpm --filter @openstage/api build

FROM node:22-alpine
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo ./
EXPOSE 3000
CMD ["sh", "-c", "node apps/api/db/migrate.mjs && node apps/api/dist/main.js"]
