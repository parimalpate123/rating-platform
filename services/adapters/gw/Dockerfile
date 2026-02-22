# Build from repo root: docker build -f services/adapters/gw/Dockerfile .
ARG NODE_VERSION=20
FROM node:${NODE_VERSION}-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx nx run adapter-gw:build
RUN npx nx run adapter-gw:prune-lockfile
RUN npx nx run adapter-gw:copy-workspace-modules

FROM node:${NODE_VERSION}-alpine AS runner

WORKDIR /app

COPY --from=builder /app/services/adapters/gw/dist ./
RUN npm ci --omit=dev

EXPOSE 3012

ENV NODE_ENV=production
ENV PORT=3012

CMD ["node", "main.js"]
