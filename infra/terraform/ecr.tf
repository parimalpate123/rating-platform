locals {
  ecr_repos = [
    "core-rating",
    "line-rating",
    "product-config",
    "transform-service",
    "rules-service",
    "status-service",
    "rating-workspace",
    "adapter-kafka",
    "adapter-dnb",
    "adapter-gw",
  ]
}

resource "aws_ecr_repository" "core_rating" {
  name                 = "rating-platform/core-rating"
  image_tag_mutability = "MUTABLE"
  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_repository" "line_rating" {
  name                 = "rating-platform/line-rating"
  image_tag_mutability = "MUTABLE"
  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_repository" "product_config" {
  name                 = "rating-platform/product-config"
  image_tag_mutability = "MUTABLE"
  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_repository" "transform" {
  name                 = "rating-platform/transform-service"
  image_tag_mutability = "MUTABLE"
  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_repository" "rules_service" {
  name                 = "rating-platform/rules-service"
  image_tag_mutability = "MUTABLE"
  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_repository" "status_service" {
  name                 = "rating-platform/status-service"
  image_tag_mutability = "MUTABLE"
  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_repository" "rating_workspace" {
  name                 = "rating-platform/rating-workspace"
  image_tag_mutability = "MUTABLE"
  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_repository" "adapter_kafka" {
  name                 = "rating-platform/adapter-kafka"
  image_tag_mutability = "MUTABLE"
  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_repository" "adapter_dnb" {
  name                 = "rating-platform/adapter-dnb"
  image_tag_mutability = "MUTABLE"
  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_repository" "adapter_gw" {
  name                 = "rating-platform/adapter-gw"
  image_tag_mutability = "MUTABLE"
  image_scanning_configuration {
    scan_on_push = true
  }
}
