# ECR repositories are created by the GitHub Actions deploy workflow (build-push job)
# so that the first run can push images without requiring Terraform to run first.
# Terraform references them here for outputs; it does not create them.

locals {
  ecr_repo_names = [
    "rating-platform/core-rating",
    "rating-platform/line-rating",
    "rating-platform/product-config",
    "rating-platform/transform-service",
    "rating-platform/rules-service",
    "rating-platform/status-service",
    "rating-platform/rating-workspace",
    "rating-platform/adapter-kafka",
    "rating-platform/adapter-dnb",
    "rating-platform/adapter-gw",
  ]
}

data "aws_ecr_repository" "core_rating" {
  name = "rating-platform/core-rating"
}

data "aws_ecr_repository" "line_rating" {
  name = "rating-platform/line-rating"
}

data "aws_ecr_repository" "product_config" {
  name = "rating-platform/product-config"
}

data "aws_ecr_repository" "transform" {
  name = "rating-platform/transform-service"
}

data "aws_ecr_repository" "rules_service" {
  name = "rating-platform/rules-service"
}

data "aws_ecr_repository" "status_service" {
  name = "rating-platform/status-service"
}

data "aws_ecr_repository" "rating_workspace" {
  name = "rating-platform/rating-workspace"
}

data "aws_ecr_repository" "adapter_kafka" {
  name = "rating-platform/adapter-kafka"
}

data "aws_ecr_repository" "adapter_dnb" {
  name = "rating-platform/adapter-dnb"
}

data "aws_ecr_repository" "adapter_gw" {
  name = "rating-platform/adapter-gw"
}
