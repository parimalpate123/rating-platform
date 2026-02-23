# Build from repo root: docker build -f services/transform-service/Dockerfile .
ARG NODE_VERSION=20
FROM node:${NODE_VERSION}-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx nx run transform-service:build
RUN npx nx run transform-service:prune-lockfile
RUN npx nx run transform-service:copy-workspace-modules

FROM node:${NODE_VERSION}-alpine AS runner

WORKDIR /app

COPY --from=builder /app/services/transform-service/dist ./
# Pruned lockfile from Nx can omit transitive deps; install from package.json
RUN npm install --omit=dev

EXPOSE 4011

ENV NODE_ENV=production
ENV PORT=4011

CMD ["node", "main.js"]
