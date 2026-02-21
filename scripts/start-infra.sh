#!/bin/bash
# Start infrastructure (Postgres, Redis, MinIO)
set -e

cd "$(dirname "$0")/.."

echo "Starting infrastructure services..."
docker compose -f docker-compose.dev.yml up -d

echo ""
echo "Waiting for Postgres to be ready..."
until docker exec rating-platform-db pg_isready -U rating_user -d rating_platform 2>/dev/null; do
  sleep 1
done

echo "Infrastructure ready!"
echo ""
echo "  Postgres:  localhost:5433  (user: rating_user, pass: rating_pass, db: rating_platform)"
echo "  Redis:     localhost:6380"
echo "  MinIO:     localhost:9010  (console: http://localhost:9011, user: minioadmin, pass: minioadmin)"
