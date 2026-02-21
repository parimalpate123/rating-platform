# Build from repo root: docker build -f services/status-service/Dockerfile .
ARG NODE_VERSION=20
FROM node:${NODE_VERSION}-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx nx run status-service:build
RUN npx nx run status-service:prune-lockfile
RUN npx nx run status-service:copy-workspace-modules

FROM node:${NODE_VERSION}-alpine AS runner

WORKDIR /app

COPY --from=builder /app/services/status-service/dist ./
RUN npm ci --omit=dev

EXPOSE 4013

ENV NODE_ENV=production
ENV PORT=4013

CMD ["node", "main.js"]
