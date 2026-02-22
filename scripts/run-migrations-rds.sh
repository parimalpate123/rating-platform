#!/usr/bin/env bash
# Run DB migrations against RDS from this workspace.
# Use when you have network access to RDS (VPN or bastion). Does not change
# scripts/run-migrations.sh, which remains for local dev.
#
# Prereqs:
#   - Terraform state available (deploy run at least once); we read rds_endpoint from it.
#   - PostgreSQL client: brew install libpq && brew link --force libpq (macOS)
#   - DB password: set DB_PASS, or we prompt (avoid putting password in shell history).
#
# Usage:
#   DB_PASS=yourpassword ./scripts/run-migrations-rds.sh
#   ./scripts/run-migrations-rds.sh   # will prompt for DB_PASS
#
# Optional: RUN_SEEDS=1 to run db/seeds after migrations.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TF_DIR="$REPO_ROOT/infra/terraform"

if [ ! -d "$TF_DIR" ]; then
  echo "error: Terraform dir not found: $TF_DIR"
  exit 1
fi

if ! command -v terraform &>/dev/null; then
  echo "error: terraform not in PATH. Install Terraform and ensure state is available."
  exit 1
fi

if ! command -v psql &>/dev/null; then
  echo "error: psql not found. Install PostgreSQL client (e.g. brew install libpq && brew link --force libpq)."
  exit 1
fi

cd "$TF_DIR"
DB_HOST=$(terraform output -raw rds_endpoint 2>/dev/null) || true
DB_PORT=$(terraform output -raw rds_port 2>/dev/null) || true
cd "$REPO_ROOT"

if [ -z "$DB_HOST" ] || [ -z "$DB_PORT" ]; then
  echo "error: Could not read rds_endpoint/rds_port from Terraform. Run deploy at least once from this repo."
  exit 1
fi

if [ -z "${DB_PASS:-}" ]; then
  echo -n "DB password (DB_PASS): "
  read -rs DB_PASS
  echo
  if [ -z "$DB_PASS" ]; then
    echo "error: DB password is required. Set DB_PASS or run again and enter it when prompted."
    exit 1
  fi
fi

export DB_HOST
export DB_PORT
export DB_USER="${DB_USER:-rating_user}"
export DB_PASS
export DB_NAME="${DB_NAME:-rating_platform}"

echo "Running migrations against RDS at $DB_HOST:$DB_PORT ..."
if ! "$SCRIPT_DIR/run-migrations.sh"; then
  echo ""
  echo "If you see 'Operation timed out' or 'connection refused', this machine cannot reach RDS (it is in a private subnet)."
  echo "Run this script from a host that can reach the VPC: VPN-connected machine or a bastion. See db/RUN_MIGRATIONS.md."
  exit 1
fi
