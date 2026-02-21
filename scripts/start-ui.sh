#!/bin/bash
# Start the frontend workspace UI
set -e
cd "$(dirname "$0")/.."

echo "Starting Rating Workspace UI..."
echo "  URL: http://localhost:4200"
echo ""
npx nx serve rating-workspace
