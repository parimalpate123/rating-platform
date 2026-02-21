#!/bin/bash
# Stop all services started by start-all.sh
set -e
cd "$(dirname "$0")/.."

services=(
  "core-rating"
  "line-rating"
  "product-config"
  "transform-service"
  "rules-service"
  "status-service"
)

echo "Stopping all services..."

for svc in "${services[@]}"; do
  pid_file="logs/$svc.pid"
  if [ -f "$pid_file" ]; then
    pid=$(cat "$pid_file")
    if kill -0 "$pid" 2>/dev/null; then
      # Kill the process group (npx spawns child processes)
      pkill -P "$pid" 2>/dev/null || true
      kill "$pid" 2>/dev/null || true
      echo "  Stopped $svc (pid $pid)"
    else
      echo "  $svc was not running"
    fi
    rm -f "$pid_file"
  else
    echo "  No PID file for $svc"
  fi
done

echo "Done."
