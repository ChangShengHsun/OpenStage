FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/shared-types ./packages/shared-types
COPY apps/api ./apps/api
# --ignore-scripts: the root `prepare` hook (workspace package builds) is for
# local clones; here the builds run explicitly on the next lines.
# shared-types is filtered EXPLICITLY (not just via api...) so pnpm installs
# its devDependencies too — tsc lives there.
RUN pnpm install --frozen-lockfile --ignore-scripts \
  --filter @openstage/api... --filter @openstage/shared-types \
  && pnpm --filter @openstage/shared-types build \
  && pnpm --filter @openstage/api build

FROM node:22-alpine
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo ./
EXPOSE 3000
CMD ["sh", "-c", "node apps/api/db/migrate.mjs && node apps/api/dist/main.js"]
