#!/usr/bin/env bash
# Run DB migrations against a target Postgres.
# Usage:
#   DB_HOST=localhost DB_PORT=5433 DB_USER=rating_user DB_PASS=rating_pass DB_NAME=rating_platform ./scripts/run-migrations.sh
#   DATABASE_URL=postgresql://user:pass@host:5432/dbname ./scripts/run-migrations.sh
# Options:
#   RUN_SEEDS=1  - also run db/seeds/*.sql after migrations (default: 0)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/db/migrations"
SEEDS_DIR="$REPO_ROOT/db/seeds"

if [ -n "$DATABASE_URL" ]; then
  PSQL_CMD="psql"
  PSQL_ARGS=("$DATABASE_URL")
else
  DB_HOST="${DB_HOST:-localhost}"
  DB_PORT="${DB_PORT:-5433}"
  DB_USER="${DB_USER:-rating_user}"
  DB_PASS="${DB_PASS:-rating_pass}"
  DB_NAME="${DB_NAME:-rating_platform}"
  export PGPASSWORD="$DB_PASS"
  PSQL_CMD="psql"
  PSQL_ARGS=(-h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME")
fi

run_sql_dir() {
  local dir="$1"
  local label="$2"
  if [ ! -d "$dir" ]; then
    echo "  (skip $label: $dir not found)"
    return 0
  fi
  for f in $(ls -1 "$dir"/*.sql 2>/dev/null | sort || true); do
    [ -f "$f" ] || continue
    echo "  Running $label $(basename "$f")..."
    "$PSQL_CMD" "${PSQL_ARGS[@]}" -f "$f" || exit 1
  done
}

echo "Running migrations from $MIGRATIONS_DIR..."
run_sql_dir "$MIGRATIONS_DIR" "migration"

if [ "${RUN_SEEDS:-0}" = "1" ]; then
  echo "Running seeds from $SEEDS_DIR..."
  run_sql_dir "$SEEDS_DIR" "seed"
fi

echo "Migrations complete."
