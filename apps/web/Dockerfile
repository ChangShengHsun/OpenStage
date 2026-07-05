# NOT YET INTEGRATION-TESTED — written to spec, verify once Docker is available.
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/shared-types ./packages/shared-types
COPY apps/web ./apps/web
RUN pnpm install --frozen-lockfile --filter @openstage/web... \
  && pnpm --filter @openstage/shared-types build \
  && pnpm --filter @openstage/web build

FROM nginx:alpine
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
