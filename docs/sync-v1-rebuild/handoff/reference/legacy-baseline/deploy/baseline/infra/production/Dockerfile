# syntax=docker/dockerfile:1.7

FROM node:24-trixie-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@11.5.2 --activate
WORKDIR /app

FROM base AS dependencies
COPY . .
RUN pnpm install --frozen-lockfile

FROM dependencies AS web-builder
ARG DEPLOYMENT_SHA
ARG SERVER_ACTIONS_KEY_FINGERPRINT
ENV DEPLOYMENT_SHA=$DEPLOYMENT_SHA
ENV NEXT_PUBLIC_APP_VERSION=$DEPLOYMENT_SHA
RUN --mount=type=secret,id=next_server_actions_encryption_key \
  test -n "$SERVER_ACTIONS_KEY_FINGERPRINT"; \
  test -s /run/secrets/next_server_actions_encryption_key; \
  export NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="$(cat /run/secrets/next_server_actions_encryption_key)"; \
  pnpm --filter @veyocast/control build \
    && pnpm --filter @veyocast/player build \
    && pnpm --filter @veyocast/marketing build

FROM node:24-trixie-slim AS control
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
WORKDIR /app
COPY --chown=node:node --from=web-builder /app/apps/control/.next/standalone ./
COPY --chown=node:node --from=web-builder /app/apps/control/.next/static ./apps/control/.next/static
COPY --chown=node:node --from=web-builder /app/apps/control/public ./apps/control/public
USER node
EXPOSE 3000
CMD ["node", "apps/control/server.js"]

FROM node:24-trixie-slim AS player
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3001
WORKDIR /app
COPY --chown=node:node --from=web-builder /app/apps/player/.next/standalone ./
COPY --chown=node:node --from=web-builder /app/apps/player/.next/static ./apps/player/.next/static
COPY --chown=node:node --from=web-builder /app/apps/player/public ./apps/player/public
USER node
EXPOSE 3001
CMD ["node", "apps/player/server.js"]

FROM node:24-trixie-slim AS marketing
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3002
WORKDIR /app
COPY --chown=node:node --from=web-builder /app/apps/marketing/.next/standalone ./
COPY --chown=node:node --from=web-builder /app/apps/marketing/.next/static ./apps/marketing/.next/static
COPY --chown=node:node --from=web-builder /app/apps/marketing/public ./apps/marketing/public
USER node
EXPOSE 3002
CMD ["node", "apps/marketing/server.js"]

FROM base AS media-worker
RUN apt-get update \
  && apt-get install --yes --no-install-recommends ca-certificates chromium ffmpeg \
  && rm -rf /var/lib/apt/lists/*
COPY --chown=node:node --from=dependencies /app /app
USER node
CMD ["node", "--import", "tsx", "apps/media-worker/src/index.ts", "--loop"]
