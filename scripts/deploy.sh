#!/usr/bin/env bash
# Full deploy: optionally run migrations, build & push images, then Terraform apply.
# Run from repo root. Requires: Docker, AWS CLI, Terraform, kubectl (for smoke test).
#
# Usage:
#   ./scripts/deploy.sh [IMAGE_TAG]
#   RUN_MIGRATIONS=1 ./scripts/deploy.sh 1.0.0
#
# Env:
#   RUN_MIGRATIONS - if 1, run scripts/run-migrations.sh first (set DB_* or DATABASE_URL)
#   SKIP_BUILD     - if 1, skip build-and-push (only Terraform apply)
#   SKIP_TERRAFORM - if 1, skip Terraform apply (only migrations + build-push)
#   IMAGE_TAG      - tag for images (default: latest)
#   TF_DIR         - path to Terraform root (default: infra/terraform)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TF_DIR="${TF_DIR:-$REPO_ROOT/infra/terraform}"
IMAGE_TAG="${1:-${IMAGE_TAG:-latest}}"

cd "$REPO_ROOT"

echo "=== Deploy: image_tag=$IMAGE_TAG ==="

if [ "${RUN_MIGRATIONS:-0}" = "1" ]; then
  echo ""
  echo "Running DB migrations..."
  "$SCRIPT_DIR/run-migrations.sh" || exit 1
else
  echo "(Skip migrations. Set RUN_MIGRATIONS=1 to run migrations.)"
fi

if [ "${SKIP_BUILD:-0}" != "1" ]; then
  echo ""
  echo "Building and pushing images..."
  IMAGE_TAG="$IMAGE_TAG" "$SCRIPT_DIR/build-and-push.sh" "$IMAGE_TAG"
else
  echo "(Skip build. Unset SKIP_BUILD to build and push.)"
fi

if [ "${SKIP_TERRAFORM:-0}" != "1" ]; then
  echo ""
  echo "Applying Terraform..."
  cd "$TF_DIR"
  if [ ! -f terraform.tfvars ] && [ -f terraform.tfvars.example ]; then
    echo "Warning: terraform.tfvars not found. Copy terraform.tfvars.example and set cluster_name."
    exit 1
  fi
  terraform init -input=false
  terraform apply -input=false -auto-approve -var "image_tag=$IMAGE_TAG"
  echo "Terraform apply done."
else
  echo "(Skip Terraform. Unset SKIP_TERRAFORM to apply.)"
fi

echo ""
echo "Deploy complete. Image tag: $IMAGE_TAG"
echo "To run smoke tests, ensure kubectl points at your EKS cluster and run:"
echo "  kubectl get pods -n rating-platform"
echo "  kubectl get ingress -n rating-platform"
