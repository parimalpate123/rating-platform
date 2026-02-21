# Build from repo root: docker build -f frontend/rating-workspace/Dockerfile .
ARG NODE_VERSION=20
FROM node:${NODE_VERSION}-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx nx run rating-workspace:build

FROM nginx:alpine AS runner

COPY --from=builder /app/frontend/rating-workspace/dist /usr/share/nginx/html
COPY frontend/rating-workspace/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
