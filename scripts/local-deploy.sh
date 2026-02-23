#!/usr/bin/env bash
# ── Local full deploy: build → push to ECR → Terraform apply (same flow as GHA) ──
#
# Run from repo root. Requires: Docker, AWS CLI (configured), Terraform, npm deps.
#
# Usage:
#   ./scripts/local-deploy.sh [IMAGE_TAG]
#   IMAGE_TAG=abc123 ./scripts/local-deploy.sh
#
# One-time setup:
#   1. AWS: aws configure (or export AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY)
#   2. Terraform: cp infra/terraform/terraform.tfvars.example infra/terraform/terraform.tfvars
#      Edit terraform.tfvars and set at least: db_password, and VPC/subnet IDs if different.
#   3. (Optional) Remote state: create S3 bucket + DynamoDB table (see infra/terraform/README.md),
#      then set TF_STATE_BUCKET to the bucket name so this script uses the same state as CI.
#
# Env:
#   IMAGE_TAG         - Docker image tag (default: git short SHA, or "latest" if not a repo)
#   ENVIRONMENT       - dev | staging | prod (default: dev). Used for Terraform state key if TF_STATE_BUCKET set.
#   TF_STATE_BUCKET   - If set, Terraform uses S3 backend (same as CI). If unset, uses local state in infra/terraform.
#   TF_VAR_db_password - RDS password for Terraform (optional if set in terraform.tfvars).
#   SKIP_BUILD        - If 1, skip build & push (only Terraform apply). You must set IMAGE_TAG to an existing tag.
#   SKIP_TERRAFORM    - If 1, skip Terraform (only build & push).
#   RUN_MIGRATIONS    - If 1, run DB migrations before deploy (set DB_* or DATABASE_URL).
#   AWS_REGION        - AWS region (default: us-east-1).
#   ECS_CLUSTER       - ECS cluster name (default: sre-poc-mcp-cluster).
#
# Examples:
#   ./scripts/local-deploy.sh
#   TF_STATE_BUCKET=my-tfstate-bucket ./scripts/local-deploy.sh
#   SKIP_BUILD=1 IMAGE_TAG=abc123 ./scripts/local-deploy.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TF_DIR="${TF_DIR:-$REPO_ROOT/infra/terraform}"
AWS_REGION="${AWS_REGION:-us-east-1}"
ENVIRONMENT="${ENVIRONMENT:-dev}"
ECS_CLUSTER="${ECS_CLUSTER:-sre-poc-mcp-cluster}"

# Image tag: first arg, or IMAGE_TAG env, or git short SHA, or latest
if [ -n "${1:-}" ]; then
  IMAGE_TAG="$1"
elif [ -n "${IMAGE_TAG:-}" ]; then
  true
elif command -v git >/dev/null 2>&1 && git rev-parse --git-dir >/dev/null 2>&1; then
  IMAGE_TAG=$(git rev-parse --short HEAD)
else
  IMAGE_TAG="latest"
fi

cd "$REPO_ROOT"

echo "=============================================="
echo "  Local deploy: tag=$IMAGE_TAG env=$ENVIRONMENT"
echo "=============================================="

# ── 1. Optional: DB migrations ─────────────────────────────────────────────
if [ "${RUN_MIGRATIONS:-0}" = "1" ]; then
  echo ""
  echo "[1/5] Running DB migrations..."
  "$SCRIPT_DIR/run-migrations.sh" || exit 1
else
  echo ""
  echo "[1/5] Skipping migrations (RUN_MIGRATIONS=1 to run)."
fi

# ── 2. Build and push Docker images to ECR ───────────────────────────────────
if [ "${SKIP_BUILD:-0}" != "1" ]; then
  echo ""
  echo "[2/5] Building and pushing images to ECR..."
  IMAGE_TAG="$IMAGE_TAG" AWS_REGION="$AWS_REGION" "$SCRIPT_DIR/build-and-push.sh" "$IMAGE_TAG"
else
  echo ""
  echo "[2/5] Skipping build (unset SKIP_BUILD to build & push)."
fi

# ── 3. Terraform init (backend: S3 if TF_STATE_BUCKET set, else local) ─────
if [ "${SKIP_TERRAFORM:-0}" != "1" ]; then
  echo ""
  echo "[3/5] Terraform init..."
  cd "$TF_DIR"

  if [ ! -f terraform.tfvars ] && [ -f terraform.tfvars.example ]; then
    echo "Error: infra/terraform/terraform.tfvars not found."
    echo "  cp infra/terraform/terraform.tfvars.example infra/terraform/terraform.tfvars"
    echo "  Then edit and set db_password and any overrides."
    exit 1
  fi

  if [ -n "${TF_STATE_BUCKET:-}" ]; then
    terraform init -input=false -reconfigure \
      -backend-config="bucket=${TF_STATE_BUCKET}" \
      -backend-config="key=rating-platform/${ENVIRONMENT}/terraform.tfstate" \
      -backend-config="region=${AWS_REGION}" \
      -backend-config="dynamodb_table=rating-platform-tfstate-locks" \
      -backend-config="encrypt=true"
  else
    echo "  (TF_STATE_BUCKET not set — using local state in $TF_DIR)"
    if grep -q 'backend "s3" {}' main.tf 2>/dev/null; then
      sed -i.bak 's|backend "s3" {}|backend "local" { path = "terraform.tfstate" }|' main.tf
      terraform init -input=false -reconfigure
      sed 's|backend "local" { path = "terraform.tfstate" }|backend "s3" {}|' main.tf > main.tf.tmp && mv main.tf.tmp main.tf
      rm -f main.tf.bak
    else
      terraform init -input=false -reconfigure
    fi
  fi

  # ── 4. Terraform apply ───────────────────────────────────────────────────
  echo ""
  echo "[4/5] Terraform apply (image_tag=$IMAGE_TAG)..."
  export TF_VAR_image_tag="$IMAGE_TAG"
  export TF_VAR_affected_services="[]"
  export TF_VAR_image_tag_previous=""
  [ -n "${TF_VAR_db_password:-}" ] && export TF_VAR_db_password

  terraform plan -input=false -out=tfplan -var "image_tag=$IMAGE_TAG"
  terraform apply -input=false -auto-approve tfplan

  # ── 5. Force ECS to pull new images and show ALB URL ─────────────────────
  echo ""
  echo "[5/5] Forcing ECS new deployment..."
  SERVICES=(core-rating line-rating product-config transform-service rules-service status-service rating-workspace adapter-kafka adapter-dnb adapter-gw)
  for svc in "${SERVICES[@]}"; do
    aws ecs update-service \
      --cluster "$ECS_CLUSTER" \
      --service "$svc" \
      --force-new-deployment \
      --region "$AWS_REGION" \
      --no-cli-pager >/dev/null 2>&1 || true
  done

  ALB_DNS=$(terraform output -raw alb_dns_name 2>/dev/null || true)
  echo ""
  echo "=============================================="
  echo "  Deploy complete."
  echo "  Image tag:  $IMAGE_TAG"
  echo "  ALB URL:   http://${ALB_DNS:-<run terraform output alb_dns_name>}"
  echo "=============================================="
else
  echo ""
  echo "[3–5] Skipping Terraform (unset SKIP_TERRAFORM to apply)."
  echo "  Deploy complete. Image tag: $IMAGE_TAG"
fi
