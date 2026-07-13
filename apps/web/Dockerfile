FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/shared-types ./packages/shared-types
COPY packages/path-planner ./packages/path-planner
COPY apps/web ./apps/web
# --ignore-scripts: the root `prepare` hook (workspace package builds) is for
# local clones; here the builds run explicitly on the next lines.
# The packages are filtered EXPLICITLY (not just via web...) so pnpm installs
# their devDependencies too — tsc lives there.
RUN pnpm install --frozen-lockfile --ignore-scripts --filter @openstage/web... \
  --filter @openstage/shared-types --filter @openstage/path-planner \
  && pnpm --filter @openstage/shared-types build \
  && pnpm --filter @openstage/path-planner build \
  && pnpm --filter @openstage/web build

FROM nginx:alpine
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
