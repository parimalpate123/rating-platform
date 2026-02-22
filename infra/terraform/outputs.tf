# ── ECS Outputs ──────────────────────────────────────────────────────────────

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = data.aws_ecs_cluster.main.cluster_name
}

output "ecs_cluster_arn" {
  description = "ECS cluster ARN"
  value       = data.aws_ecs_cluster.main.arn
}

output "ecs_service_names" {
  description = "Map of ECS service names"
  value       = { for k, v in aws_ecs_service.services : k => v.name }
}

# ── ECR Outputs ──────────────────────────────────────────────────────────────

output "ecr_repository_urls" {
  description = "ECR repository URLs for each service"
  value = {
    core-rating      = aws_ecr_repository.core_rating.repository_url
    line-rating      = aws_ecr_repository.line_rating.repository_url
    product-config   = aws_ecr_repository.product_config.repository_url
    transform        = aws_ecr_repository.transform.repository_url
    rules-service    = aws_ecr_repository.rules_service.repository_url
    status-service   = aws_ecr_repository.status_service.repository_url
    rating-workspace = aws_ecr_repository.rating_workspace.repository_url
    adapter-kafka    = aws_ecr_repository.adapter_kafka.repository_url
    adapter-dnb      = aws_ecr_repository.adapter_dnb.repository_url
    adapter-gw       = aws_ecr_repository.adapter_gw.repository_url
  }
}

output "ecr_registry" {
  description = "ECR registry URL (account + region) for docker push"
  value       = local.ecr_registry
}

# ── ALB Outputs ──────────────────────────────────────────────────────────────

output "alb_dns_name" {
  description = "ALB DNS name — use this as the CNAME target for your domain"
  value       = var.ingress_enabled ? aws_lb.main[0].dns_name : ""
}

output "alb_arn" {
  description = "ALB ARN"
  value       = var.ingress_enabled ? aws_lb.main[0].arn : ""
}

# ── RDS Outputs ──────────────────────────────────────────────────────────────

output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint (only when create_rds = true)"
  value       = var.create_rds ? aws_db_instance.main[0].address : var.db_host
}

output "rds_port" {
  description = "RDS PostgreSQL port"
  value       = var.create_rds ? aws_db_instance.main[0].port : tonumber(var.db_port)
}

# ── IAM Outputs ──────────────────────────────────────────────────────────────

output "ecs_task_execution_role_arn" {
  description = "IAM role ARN for ECS task execution"
  value       = aws_iam_role.ecs_task_execution.arn
}

output "rules_service_task_role_arn" {
  description = "IAM role ARN for rules-service (Bedrock access)"
  value       = aws_iam_role.ecs_task_rules_service.arn
}

# ── Service Discovery ───────────────────────────────────────────────────────

output "service_discovery_namespace" {
  description = "Cloud Map namespace for service discovery"
  value       = aws_service_discovery_private_dns_namespace.main.name
}
