# ── AWS identity / region ─────────────────────────────────────────────────────

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# ── Existing ECS cluster ─────────────────────────────────────────────────────

data "aws_ecs_cluster" "main" {
  cluster_name = var.ecs_cluster_name
}
