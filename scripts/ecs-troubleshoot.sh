#!/usr/bin/env bash
# Quick ECS troubleshooting: show stopped task reasons and recent CloudWatch logs for a service.
# Usage: ./scripts/ecs-troubleshoot.sh [service-name]
# Example: ./scripts/ecs-troubleshoot.sh product-config

set -e

CLUSTER="${ECS_CLUSTER:-sre-poc-mcp-cluster}"
REGION="${AWS_REGION:-us-east-1}"
LOG_GROUP="/ecs/rating-platform"
SVC="${1:-product-config}"

echo "=== Stopped task reason: $SVC ==="
TASK_ARN=$(aws ecs list-tasks --cluster "$CLUSTER" --service-name "$SVC" --desired-status STOPPED --region "$REGION" --query 'taskArns[0]' --output text 2>/dev/null)
if [ -z "$TASK_ARN" ] || [ "$TASK_ARN" = "None" ]; then
  echo "No stopped task found."
else
  aws ecs describe-tasks --cluster "$CLUSTER" --tasks "$TASK_ARN" --region "$REGION" \
    --query 'tasks[0].{stoppedReason:stoppedReason,containers:containers[0].{reason:reason,exitCode:exitCode}}' --output json
fi

echo ""
echo "=== Recent CloudWatch logs: $SVC (last 5 min) ==="
STREAM_PREFIX="$SVC/"
START_MS=$(($(date +%s) - 300))000
aws logs filter-log-events \
  --log-group-name "$LOG_GROUP" \
  --log-stream-name-prefix "$STREAM_PREFIX" \
  --start-time "$START_MS" \
  --region "$REGION" \
  --query 'events[*].message' \
  --output text 2>/dev/null | tail -80 || echo "No recent logs or log group not found."
