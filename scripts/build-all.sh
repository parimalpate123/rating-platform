#!/bin/bash
# Build all backend services via nx
# Usage: ./scripts/build-all.sh [service-name]
#   No args  → builds all services
#   With arg → builds only that service (e.g. ./scripts/build-all.sh core-rating)
#
# Requires: run "npm install" from repo root first. If you see "Could not find Nx modules",
# run: npm install

cd "$(dirname "$0")/.."

if [ ! -d "node_modules/nx" ]; then
  echo "Nx not found in node_modules. Run from repo root: npm install"
  exit 1
fi

# Use project's nx (npm exec) so we don't pull a different version via npx
NX_CMD="npm exec -- nx"

declare -a services=(
  "core-rating"
  "line-rating"
  "product-config"
  "transform-service"
  "rules-service"
  "status-service"
  "adapter-kafka"
  "adapter-dnb"
  "adapter-gw"
)

if [ -n "$1" ]; then
  echo "Building $1..."
  $NX_CMD build "$1"
  exit $?
fi

echo "Building all services..."
echo ""

failed=0
for svc in "${services[@]}"; do
  echo "── Building $svc ──"
  if $NX_CMD build "$svc" 2>&1; then
    echo "  ✓ $svc built successfully"
  else
    echo "  ✗ $svc build FAILED"
    failed=$((failed + 1))
  fi
  echo ""
done

if [ $failed -eq 0 ]; then
  echo "All ${#services[@]} services built successfully."
  echo ""
  echo "Next: ./scripts/start-all.sh"
else
  echo "$failed service(s) failed to build."
  exit 1
fi
