#!/bin/bash
# Verify AWS credentials (used by rules-service for Bedrock).
# Run from repo root: ./scripts/verify-aws-credentials.sh
# If this fails, Bedrock will fail with "The security token included in the request is invalid."

cd "$(dirname "$0")/.."

if [ -f .env ]; then
  set -a
  source .env
  set +a
  echo "Loaded .env (AWS_REGION=${AWS_REGION:-not set}, AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID:+set})"
fi

echo ""
echo "Testing AWS credentials (STS GetCallerIdentity)..."
if aws sts get-caller-identity --region "${AWS_REGION:-us-east-1}" 2>&1; then
  echo ""
  echo "Credentials are valid. If Bedrock still fails, check IAM permissions for bedrock:InvokeModel."
else
  echo ""
  echo "Credentials are INVALID. Fix:"
  echo "  1. IAM Console → Users → your user → Security credentials → Create access key"
  echo "  2. Put in .env (no quotes, no spaces around =):"
  echo "     AWS_REGION=us-east-1"
  echo "     AWS_ACCESS_KEY_ID=AKIA..."
  echo "     AWS_SECRET_ACCESS_KEY=..."
  echo "  3. Or remove AWS_ACCESS_KEY_ID/SECRET from .env and run: aws configure"
  echo "     Then restart rules-service so it uses ~/.aws/credentials"
  exit 1
fi
