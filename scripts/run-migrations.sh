#!/usr/bin/env bash
# Run DB migrations against a target Postgres.
# Usage:
#   DB_HOST=localhost DB_PORT=5433 DB_USER=rating_user DB_PASS=rating_pass DB_NAME=rating_platform ./scripts/run-migrations.sh
#   DATABASE_URL=postgresql://user:pass@host:5432/dbname ./scripts/run-migrations.sh
#
# Local dev (no psql required): start infra first (./scripts/start-infra.sh), then run this.
# The script uses the running postgres container (rating-platform-db) when targeting
# localhost with default dev credentials, so you don't need PostgreSQL installed on the host.
# Options:
#   RUN_SEEDS=1  - also run db/seeds/*.sql after migrations (default: 0)
#
# CI (GitHub Actions): the deploy workflow passes DB_HOST/DB_PORT from Terraform output;
# the workflow fails before calling this script if RDS is not in state. Local defaults below
# are only used when those env vars are unset (e.g. local testing).

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/db/migrations"
SEEDS_DIR="$REPO_ROOT/db/seeds"

DEV_CONTAINER="rating-platform-db"
# Paths inside the container (docker-compose.dev.yml mounts db/migrations and db/seeds there)
CONTAINER_MIGRATIONS="/docker-entrypoint-initdb.d/migrations"
CONTAINER_SEEDS="/docker-entrypoint-initdb.d/seeds"

use_container_exec() {
  docker exec "$DEV_CONTAINER" pg_isready -U rating_user -d rating_platform &>/dev/null
}

# -q: quiet (suppress NOTICEs like "relation X already exists, skipping" on re-runs)
if [ -n "$DATABASE_URL" ]; then
  PSQL_CMD="psql"
  PSQL_ARGS=(-q "$DATABASE_URL")
  RUN_VIA_CONTAINER=0
else
  # Local dev defaults; CI always passes DB_HOST/DB_PORT from Terraform (workflow fails if missing)
  DB_HOST="${DB_HOST:-localhost}"
  DB_PORT="${DB_PORT:-5433}"
  DB_USER="${DB_USER:-rating_user}"
  DB_PASS="${DB_PASS:-rating_pass}"
  DB_NAME="${DB_NAME:-rating_platform}"
  export PGPASSWORD="$DB_PASS"

  if command -v psql &>/dev/null; then
    PSQL_CMD="psql"
    PSQL_ARGS=(-q -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME")
    RUN_VIA_CONTAINER=0
  elif [ "$DB_HOST" = "localhost" ] || [ "$DB_HOST" = "127.0.0.1" ]; then
    if use_container_exec; then
      RUN_VIA_CONTAINER=1
    else
      echo "error: psql not found and dev Postgres container ($DEV_CONTAINER) is not running."
      echo "  Start infra first: ./scripts/start-infra.sh"
      echo "  Or install PostgreSQL client: brew install libpq && brew link --force libpq"
      exit 1
    fi
  else
    echo "error: psql not found. Install PostgreSQL client to run migrations against $DB_HOST."
    echo "  brew install libpq && brew link --force libpq"
    exit 1
  fi
fi

run_sql_dir() {
  local dir="$1"
  local label="$2"
  local container_dir="$3"
  if [ ! -d "$dir" ]; then
    echo "  (skip $label: $dir not found)"
    return 0
  fi
  if [ "$RUN_VIA_CONTAINER" = "1" ]; then
    for f in $(ls -1 "$dir"/*.sql 2>/dev/null | sort || true); do
      [ -f "$f" ] || continue
      echo "  Running $label $(basename "$f")..."
      docker exec "$DEV_CONTAINER" psql -q -U rating_user -d rating_platform -f "$container_dir/$(basename "$f")" || exit 1
    done
  else
    for f in $(ls -1 "$dir"/*.sql 2>/dev/null | sort || true); do
      [ -f "$f" ] || continue
      echo "  Running $label $(basename "$f")..."
      "$PSQL_CMD" "${PSQL_ARGS[@]}" -f "$f" || exit 1
    done
  fi
}

if [ "$RUN_VIA_CONTAINER" = "1" ]; then
  echo "Using Postgres container ($DEV_CONTAINER) for migrations (no host psql required)."
fi

echo "Running migrations from $MIGRATIONS_DIR..."
run_sql_dir "$MIGRATIONS_DIR" "migration" "$CONTAINER_MIGRATIONS"

if [ "${RUN_SEEDS:-0}" = "1" ]; then
  echo "Running seeds from $SEEDS_DIR..."
  run_sql_dir "$SEEDS_DIR" "seed" "$CONTAINER_SEEDS"
fi

echo "Migrations complete."
