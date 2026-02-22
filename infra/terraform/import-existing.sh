#!/usr/bin/env bash
# One-time script to import existing AWS resources into Terraform state.
# Use when resources were created by a previous apply and state was lost (e.g. CI without TF_STATE_BUCKET).
#
# Prerequisites:
#   - AWS CLI configured (or AWS_* env vars)
#   - Terraform init already run WITH S3 backend (TF_STATE_BUCKET set and init used it)
#
# Usage:
#   cd infra/terraform
#   export AWS_REGION=us-east-1   # or your region
#   export TF_VAR_vpc_id=vpc-xxx # if your VPC differs from default in variables.tf
#   ./import-existing.sh [environment]
#
# Optional: set TF_VAR_environment=dev and pass tfvars so Terraform knows the env (default: dev).

set -e

command -v terraform >/dev/null 2>&1 || { echo "Error: terraform not found. Install Terraform and ensure it is on PATH."; exit 1; }
command -v aws >/dev/null 2>&1 || { echo "Error: aws CLI not found. Install AWS CLI and ensure it is on PATH."; exit 1; }

ENV="${1:-dev}"
REGION="${AWS_REGION:-us-east-1}"
VPC_ID="${TF_VAR_vpc_id:-vpc-066faf68d1d601ae1}"

# Require init with S3 backend (fail only on "Backend initialization required"; empty state is ok)
TF_OUT=$(terraform state list 2>&1) || true
if echo "$TF_OUT" | grep -q "Backend initialization required"; then
  echo "Error: Terraform backend not ready. Run init first with your real S3 bucket, e.g.:"
  echo "  terraform init -input=false -reconfigure \\"
  echo "    -backend-config=bucket=YOUR_ACTUAL_BUCKET_NAME \\"
  echo "    -backend-config=key=rating-platform/${ENV}/terraform.tfstate \\"
  echo "    -backend-config=region=${REGION} \\"
  echo "    -backend-config=dynamodb_table=rating-platform-tfstate-locks \\"
  echo "    -backend-config=encrypt=true"
  echo "Replace YOUR_ACTUAL_BUCKET_NAME with the TF_STATE_BUCKET value (e.g. rating-platform-tfstate-551481644633)."
  exit 1
fi

echo "Importing existing resources for environment=$ENV region=$REGION vpc_id=$VPC_ID"

import() {
  local addr="$1"
  local id="$2"
  if terraform state show "$addr" &>/dev/null; then
    echo "  skip $addr (already in state)"
  else
    echo "  import $addr"
    terraform import -input=false "$addr" "$id" || echo "  warn: import $addr failed"
  fi
}

# IAM roles (by name)
import 'aws_iam_role.ecs_task_execution' "rating-platform-ecs-exec-${ENV}"
import 'aws_iam_role.ecs_task_default' "rating-platform-ecs-task-${ENV}"
import 'aws_iam_role.ecs_task_rules_service' "rating-platform-rules-svc-${ENV}"

# IAM role policy attachment and inline policy
import 'aws_iam_role_policy_attachment.ecs_task_execution' "rating-platform-ecs-exec-${ENV}/arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
import 'aws_iam_role_policy.rules_service_bedrock' "rating-platform-rules-svc-${ENV}:bedrock-access"

# CloudWatch log group (by name)
import 'aws_cloudwatch_log_group.ecs' "/ecs/rating-platform"

# DB subnet group (by name)
import 'aws_db_subnet_group.main[0]' "rating-platform-${ENV}"

# Secrets Manager (by name)
import 'aws_secretsmanager_secret.aws_credentials' "rating-platform/aws-credentials"
import 'aws_secretsmanager_secret.db_credentials' "rating-platform/db-credentials"

# Security group ALB (look up by name in VPC)
SG_ALB=$(aws ec2 describe-security-groups --region "$REGION" \
  --filters "Name=group-name,Values=rating-platform-alb-${ENV}" "Name=vpc-id,Values=$VPC_ID" \
  --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || true)
if [ -n "$SG_ALB" ] && [ "$SG_ALB" != "None" ]; then
  import 'aws_security_group.alb[0]' "$SG_ALB"
fi

# Target groups (look up ARN by name)
tg_list="rp-frontend-${ENV} rp-core-rating-${ENV} rp-line-rating-${ENV} rp-product-config-${ENV} rp-transform-${ENV} rp-rules-svc-${ENV} rp-status-svc-${ENV}"
for tg_name in $tg_list; do
  ARN=$(aws elbv2 describe-target-groups --region "$REGION" --names "$tg_name" --query 'TargetGroups[0].TargetGroupArn' --output text 2>/dev/null || true)
  if [ -n "$ARN" ] && [ "$ARN" != "None" ]; then
    case "$tg_name" in
      rp-frontend-*)       import 'aws_lb_target_group.frontend[0]' "$ARN" ;;
      rp-core-rating-*)    import 'aws_lb_target_group.core_rating[0]' "$ARN" ;;
      rp-line-rating-*)    import 'aws_lb_target_group.line_rating[0]' "$ARN" ;;
      rp-product-config-*) import 'aws_lb_target_group.product_config[0]' "$ARN" ;;
      rp-transform-*)      import 'aws_lb_target_group.transform_service[0]' "$ARN" ;;
      rp-rules-svc-*)      import 'aws_lb_target_group.rules_service[0]' "$ARN" ;;
      rp-status-svc-*)     import 'aws_lb_target_group.status_service[0]' "$ARN" ;;
    esac
  fi
done

# Service Discovery namespace (import ID format: NAMESPACE_ID:VPC_ID)
NS_ID=$(aws servicediscovery list-namespaces --region "$REGION" --query "Namespaces[?Name=='rating-platform.local'].Id | [0]" --output text 2>/dev/null || true)
if [ -n "$NS_ID" ] && [ "$NS_ID" != "None" ]; then
  import 'aws_service_discovery_private_dns_namespace.main' "${NS_ID}:${VPC_ID}"
fi

echo "Done. Run: terraform plan -out=tfplan && terraform apply tfplan"
