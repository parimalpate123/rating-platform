#!/usr/bin/env bash
# One-time: create S3 bucket and DynamoDB table for Terraform remote state.
# Run from infra/terraform with AWS CLI configured (same account/region as your deploy).
#
# Usage:
#   cd infra/terraform
#   export AWS_REGION=us-east-1   # optional, default us-east-1
#   ./bootstrap-remote-state.sh
#
# Then set GitHub repo variable TF_STATE_BUCKET to the printed bucket name,
# and run: terraform init -backend-config=bucket=... (see README).

set -e

command -v aws >/dev/null 2>&1 || { echo "Error: aws CLI not found."; exit 1; }

REGION="${AWS_REGION:-us-east-1}"
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
BUCKET="rating-platform-tfstate-${ACCOUNT}"
TABLE="rating-platform-tfstate-locks"

echo "Region: $REGION  Account: $ACCOUNT"
echo "Bucket: $BUCKET"
echo ""

# S3 bucket
if aws s3api head-bucket --bucket "$BUCKET" --region "$REGION" 2>/dev/null; then
  echo "S3 bucket $BUCKET already exists."
else
  echo "Creating S3 bucket $BUCKET ..."
  aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
    $( [ "$REGION" != "us-east-1" ] && echo "--create-bucket-configuration LocationConstraint=$REGION" )
  aws s3api put-bucket-versioning --bucket "$BUCKET" --versioning-configuration Status=Enabled
  echo "Created S3 bucket $BUCKET with versioning."
fi

# DynamoDB table
if aws dynamodb describe-table --table-name "$TABLE" --region "$REGION" &>/dev/null; then
  echo "DynamoDB table $TABLE already exists."
else
  echo "Creating DynamoDB table $TABLE ..."
  aws dynamodb create-table --table-name "$TABLE" --region "$REGION" \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST
  echo "Waiting for table to be active..."
  aws dynamodb wait table-exists --table-name "$TABLE" --region "$REGION"
  echo "Created DynamoDB table $TABLE."
fi

echo ""
echo "Done. Next steps:"
echo "  1. Add GitHub repo variable: TF_STATE_BUCKET = $BUCKET"
echo "  2. terraform init -input=false -reconfigure \\"
echo "       -backend-config=bucket=$BUCKET \\"
echo "       -backend-config=key=rating-platform/dev/terraform.tfstate \\"
echo "       -backend-config=region=$REGION \\"
echo "       -backend-config=dynamodb_table=$TABLE \\"
echo "       -backend-config=encrypt=true"
echo "  3. ./import-existing.sh dev   # if you have existing resources to import"
