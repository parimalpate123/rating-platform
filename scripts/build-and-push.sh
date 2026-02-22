#!/usr/bin/env bash
# Build each app with Nx, build Docker image, push to ECR.
# Run from repo root. Requires: Docker, AWS CLI, npm deps installed.
#
# Usage:
#   ./scripts/build-and-push.sh [IMAGE_TAG]
#   ECR_REGISTRY=123456789.dkr.ecr.us-east-1.amazonaws.com IMAGE_TAG=1.0.0 ./scripts/build-and-push.sh
#
# Env:
#   ECR_REGISTRY  - ECR host (default: from aws sts get-caller-identity + region)
#   IMAGE_TAG     - Tag for images (default: latest)
#   AWS_REGION    - AWS region for ECR (default: from aws configure)
#   SERVICES      - Space-separated list to build only (default: all)
#                   e.g. SERVICES="core-rating product-config"

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

IMAGE_TAG="${1:-${IMAGE_TAG:-latest}}"
AWS_REGION="${AWS_REGION:-$(aws configure get region 2>/dev/null || true)}"
AWS_REGION="${AWS_REGION:-us-east-1}"

if [ -z "$ECR_REGISTRY" ]; then
  AWS_ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text 2>/dev/null)"
  if [ -z "$AWS_ACCOUNT_ID" ]; then
    echo "Error: ECR_REGISTRY not set and could not get AWS account (run 'aws sts get-caller-identity')"
    exit 1
  fi
  ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
fi

# Service list: dockerfile path (relative to repo root) : Nx project name : ECR repo name
# ECR repo name must match Terraform aws_ecr_repository name (rating-platform/...)
SVC_CORE_RATING="orchestrators/core-rating/Dockerfile:core-rating:rating-platform/core-rating"
SVC_LINE_RATING="orchestrators/line-rating/Dockerfile:line-rating:rating-platform/line-rating"
SVC_PRODUCT_CONFIG="services/product-config/Dockerfile:product-config:rating-platform/product-config"
SVC_TRANSFORM="services/transform-service/Dockerfile:transform-service:rating-platform/transform-service"
SVC_RULES="services/rules-service/Dockerfile:rules-service:rating-platform/rules-service"
SVC_STATUS="services/status-service/Dockerfile:status-service:rating-platform/status-service"
SVC_WORKSPACE="frontend/rating-workspace/Dockerfile:rating-workspace:rating-platform/rating-workspace"
SVC_ADAPTER_KAFKA="services/adapters/kafka/Dockerfile:adapter-kafka:rating-platform/adapter-kafka"
SVC_ADAPTER_DNB="services/adapters/dnb/Dockerfile:adapter-dnb:rating-platform/adapter-dnb"
SVC_ADAPTER_GW="services/adapters/gw/Dockerfile:adapter-gw:rating-platform/adapter-gw"

ALL_SERVICES="$SVC_CORE_RATING $SVC_LINE_RATING $SVC_PRODUCT_CONFIG $SVC_TRANSFORM $SVC_RULES $SVC_STATUS $SVC_WORKSPACE $SVC_ADAPTER_KAFKA $SVC_ADAPTER_DNB $SVC_ADAPTER_GW"

if [ -n "$SERVICES" ]; then
  BUILD_LIST=""
  for s in $SERVICES; do
    for def in $ALL_SERVICES; do
      nx_name=$(echo "$def" | cut -d: -f2)
      if [ "$nx_name" = "$s" ]; then
        BUILD_LIST="$BUILD_LIST $def"
        break
      fi
    done
  done
  [ -n "$BUILD_LIST" ] || { echo "No matching services for: $SERVICES"; exit 1; }
else
  BUILD_LIST="$ALL_SERVICES"
fi

echo "ECR registry: $ECR_REGISTRY"
echo "Image tag: $IMAGE_TAG"
echo "Logging in to ECR..."
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$ECR_REGISTRY"

for def in $BUILD_LIST; do
  dockerfile=$(echo "$def" | cut -d: -f1)
  nx_project=$(echo "$def" | cut -d: -f2)
  ecr_name=$(echo "$def" | cut -d: -f3)
  image_uri="${ECR_REGISTRY}/${ecr_name}:${IMAGE_TAG}"

  echo ""
  echo "=== Building $nx_project (Dockerfile: $dockerfile) ==="
  if [ "$nx_project" = "rating-workspace" ]; then
    npx nx run rating-workspace:build
  else
    npx nx run "$nx_project":build
    npx nx run "$nx_project":prune-lockfile
    npx nx run "$nx_project":copy-workspace-modules
  fi
  docker build -f "$dockerfile" -t "$image_uri" .
  echo "Pushing $image_uri ..."
  docker push "$image_uri"
done

echo ""
echo "Done. Images pushed with tag: $IMAGE_TAG"
