# Build from repo root: docker build -f orchestrators/line-rating/Dockerfile .
ARG NODE_VERSION=20
FROM node:${NODE_VERSION}-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx nx run line-rating:build
RUN npx nx run line-rating:prune-lockfile
RUN npx nx run line-rating:copy-workspace-modules

FROM node:${NODE_VERSION}-alpine AS runner

WORKDIR /app

COPY --from=builder /app/orchestrators/line-rating/dist ./
# Pruned lockfile from Nx can omit some transitive deps; install from package.json
RUN npm install --omit=dev

EXPOSE 4001

ENV NODE_ENV=production
ENV PORT=4001

CMD ["node", "main.js"]
