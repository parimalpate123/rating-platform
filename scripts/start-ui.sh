#!/bin/bash
# Start the frontend workspace UI
# The UI proxies /api/product-config etc. to localhost:4010, 4012, etc.
# Start backends first: ./scripts/start-infra.sh && ./scripts/start-all.sh
set -e
cd "$(dirname "$0")/.."

# Quick check: is product-config (port 4010) reachable? If not, proxy will get ECONNREFUSED.
if ! (command -v curl >/dev/null 2>&1 && curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 "http://localhost:4010/api/v1/health" 2>/dev/null | grep -q 200); then
  echo "⚠️  Backend not detected on port 4010 (product-config)."
  echo "   The UI will load but API calls will fail with 'proxy error: ECONNREFUSED'."
  echo "   To fix: run in separate terminals (or in order):"
  echo "     1. ./scripts/start-infra.sh   # Postgres, etc."
  echo "     2. ./scripts/start-all.sh     # All backend services"
  echo "   Then run this script again."
  echo ""
fi

echo "Starting Rating Workspace UI..."
echo "  URL: http://localhost:4200"
echo ""
npx nx serve rating-workspace
