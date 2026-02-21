# Build from repo root: docker build -f orchestrators/core-rating/Dockerfile .
ARG NODE_VERSION=20
FROM node:${NODE_VERSION}-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx nx run core-rating:build
RUN npx nx run core-rating:prune-lockfile
RUN npx nx run core-rating:copy-workspace-modules

FROM node:${NODE_VERSION}-alpine AS runner

WORKDIR /app

COPY --from=builder /app/orchestrators/core-rating/dist ./
RUN npm ci --omit=dev

EXPOSE 4000

ENV NODE_ENV=production
ENV PORT=4000

CMD ["node", "main.js"]
