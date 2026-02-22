# Build from repo root: docker build -f services/product-config/Dockerfile .
ARG NODE_VERSION=20
FROM node:${NODE_VERSION}-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx nx run product-config:build
RUN npx nx run product-config:prune-lockfile
RUN npx nx run product-config:copy-workspace-modules

FROM node:${NODE_VERSION}-alpine AS runner

WORKDIR /app

COPY --from=builder /app/services/product-config/dist ./
# Pruned lockfile can be out of sync for this project (Nx nested deps); install from package.json
RUN npm install --omit=dev

EXPOSE 4010

ENV NODE_ENV=production
ENV PORT=4010

CMD ["node", "main.js"]
