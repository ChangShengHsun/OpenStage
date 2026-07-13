FROM node:22-alpine
RUN corepack enable
WORKDIR /repo
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/collab-server ./apps/collab-server
# --ignore-scripts: skip the root `prepare` hook (no workspace packages here).
RUN pnpm install --frozen-lockfile --ignore-scripts --filter @openstage/collab-server
ENV HOST=0.0.0.0 PORT=1234
EXPOSE 1234
CMD ["pnpm", "--filter", "@openstage/collab-server", "start"]
