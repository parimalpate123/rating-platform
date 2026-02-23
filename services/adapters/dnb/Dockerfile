# Build from repo root: docker build -f services/adapters/dnb/Dockerfile .
ARG NODE_VERSION=20
FROM node:${NODE_VERSION}-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx nx run adapter-dnb:build
RUN npx nx run adapter-dnb:prune-lockfile
RUN npx nx run adapter-dnb:copy-workspace-modules

FROM node:${NODE_VERSION}-alpine AS runner

WORKDIR /app

COPY --from=builder /app/services/adapters/dnb/dist ./
# Pruned lockfile from Nx can omit transitive deps; install from package.json
RUN npm install --omit=dev

EXPOSE 3011

ENV NODE_ENV=production
ENV PORT=3011

CMD ["node", "main.js"]
