# ── CloudWatch Log Group ──────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/ecs/rating-platform"
  retention_in_days = 30

  tags = {
    Environment = var.environment
    Application = "rating-platform"
  }
}

# ── Service Discovery (Cloud Map) ────────────────────────────────────────────

resource "aws_service_discovery_private_dns_namespace" "main" {
  name        = var.service_discovery_namespace
  description = "Private DNS namespace for rating-platform ECS services"
  vpc         = var.vpc_id

  tags = {
    Environment = var.environment
    Application = "rating-platform"
  }
}
