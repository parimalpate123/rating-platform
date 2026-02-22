#!/bin/bash
# Start all services directly via node (bypasses nx serve lock issues on macOS)
# Each service runs in background and logs to logs/<service>.log

cd "$(dirname "$0")/.."

mkdir -p logs

# Kill any existing service processes
pkill -f "services/product-config/dist/main.js" 2>/dev/null || true
pkill -f "services/rules-service/dist/main.js" 2>/dev/null || true
pkill -f "services/transform-service/dist/main.js" 2>/dev/null || true
pkill -f "services/status-service/dist/main.js" 2>/dev/null || true
pkill -f "orchestrators/core-rating/dist/main.js" 2>/dev/null || true
pkill -f "orchestrators/line-rating/dist/main.js" 2>/dev/null || true
pkill -f "adapters/kafka/dist/main.js" 2>/dev/null || true
pkill -f "adapters/dnb/dist/main.js" 2>/dev/null || true
pkill -f "adapters/gw/dist/main.js" 2>/dev/null || true
sleep 1

echo "Starting all services..."

# Service definitions: "name:dist_path:port"
declare -a svc_defs=(
  "core-rating:orchestrators/core-rating/dist/main.js:4000"
  "line-rating:orchestrators/line-rating/dist/main.js:4001"
  "product-config:services/product-config/dist/main.js:4010"
  "transform-service:services/transform-service/dist/main.js:4011"
  "rules-service:services/rules-service/dist/main.js:4012"
  "status-service:services/status-service/dist/main.js:4013"
  "adapter-kafka:services/adapters/kafka/dist/main.js:3010"
  "adapter-dnb:services/adapters/dnb/dist/main.js:3011"
  "adapter-gw:services/adapters/gw/dist/main.js:3012"
)

for def in "${svc_defs[@]}"; do
  name=$(echo "$def" | cut -d: -f1)
  path=$(echo "$def" | cut -d: -f2)
  echo "  Starting $name..."
  node "$path" > "logs/$name.log" 2>&1 &
  echo $! > "logs/$name.pid"
done

echo ""
echo "All services starting. Waiting 8 seconds for boot..."
sleep 8

echo ""
echo "Health checks:"

for def in "${svc_defs[@]}"; do
  name=$(echo "$def" | cut -d: -f1)
  port=$(echo "$def" | cut -d: -f3)
  result=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$port/api/v1/health" 2>/dev/null)
  if [ "$result" = "200" ]; then
    echo "  ✓ $name (port $port)"
  else
    echo "  ✗ $name (port $port) — HTTP $result — check logs/$name.log"
  fi
done

echo ""
echo "Logs: logs/<service>.log"
echo "Stop: scripts/stop-all.sh"
