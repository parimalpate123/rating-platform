#!/bin/bash
# Build all backend services via nx
# Usage: ./scripts/build-all.sh [service-name]
#   No args  → builds all services
#   With arg → builds only that service (e.g. ./scripts/build-all.sh core-rating)

cd "$(dirname "$0")/.."

declare -a services=(
  "core-rating"
  "line-rating"
  "product-config"
  "transform-service"
  "rules-service"
  "status-service"
)

if [ -n "$1" ]; then
  echo "Building $1..."
  npx nx build "$1"
  exit $?
fi

echo "Building all services..."
echo ""

failed=0
for svc in "${services[@]}"; do
  echo "── Building $svc ──"
  if npx nx build "$svc" 2>&1; then
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
