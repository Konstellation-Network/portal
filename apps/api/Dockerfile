# Portal API image. Build from the repo root:
#   docker build -f apps/api/Dockerfile -t portal-api .
# The same image runs on GCP (Cloud Run) and Contabo (Docker Compose); the
# platform is configuration (PLATFORM, DATABASE_URL, secrets), never a rebuild.
#
# Node 24 runs the TypeScript source directly (type stripping), so there is no
# compile step. No secret is baked in: every one is passed at runtime.
#
# Base pinned by digest (the multi-arch index of node:24-alpine).
# To bump: `docker buildx imagetools inspect node:24-alpine` → Digest.

FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/adapters/package.json packages/adapters/
COPY packages/config/package.json packages/config/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY packages/sdk/package.json packages/sdk/
RUN npm ci --ignore-scripts --omit=dev -w @portal/api

FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY apps/api/package.json apps/api/
COPY apps/api/src apps/api/src
COPY packages/adapters packages/adapters
COPY packages/config packages/config
COPY packages/core packages/core
COPY packages/db packages/db
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT:-8080}/healthz >/dev/null || exit 1
CMD ["node", "apps/api/src/server.ts"]
