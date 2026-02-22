# Build from repo root: docker build -f services/adapters/kafka/Dockerfile .
ARG NODE_VERSION=20
FROM node:${NODE_VERSION}-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx nx run adapter-kafka:build
RUN npx nx run adapter-kafka:prune-lockfile
RUN npx nx run adapter-kafka:copy-workspace-modules

FROM node:${NODE_VERSION}-alpine AS runner

WORKDIR /app

COPY --from=builder /app/services/adapters/kafka/dist ./
RUN npm ci --omit=dev

EXPOSE 3010

ENV NODE_ENV=production
ENV PORT=3010

CMD ["node", "main.js"]
