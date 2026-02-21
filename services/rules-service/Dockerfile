# Build from repo root: docker build -f services/rules-service/Dockerfile .
ARG NODE_VERSION=20
FROM node:${NODE_VERSION}-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx nx run rules-service:build
RUN npx nx run rules-service:prune-lockfile
RUN npx nx run rules-service:copy-workspace-modules

FROM node:${NODE_VERSION}-alpine AS runner

WORKDIR /app

COPY --from=builder /app/services/rules-service/dist ./
RUN npm ci --omit=dev

EXPOSE 4012

ENV NODE_ENV=production
ENV PORT=4012

CMD ["node", "main.js"]
