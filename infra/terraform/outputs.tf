output "cluster_name" {
  description = "EKS cluster name"
  value       = var.cluster_name
}

output "cluster_endpoint" {
  description = "EKS cluster API endpoint"
  value       = local.eks_endpoint
  sensitive   = true
}

output "namespace" {
  description = "Kubernetes namespace for rating-platform"
  value       = kubernetes_namespace.main.metadata[0].name
}

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

output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint (only when create_rds = true)"
  value       = var.create_rds ? aws_db_instance.main[0].address : var.db_host
}

output "rds_port" {
  description = "RDS PostgreSQL port"
  value       = var.create_rds ? aws_db_instance.main[0].port : tonumber(var.db_port)
}

output "alb_dns_name" {
  description = "ALB DNS name — use this as the CNAME target for your domain"
  value       = var.ingress_enabled ? kubernetes_ingress_v1.main[0].status[0].load_balancer[0].ingress[0].hostname : ""
}

output "alb_controller_role_arn" {
  description = "IAM role ARN for the AWS Load Balancer Controller"
  value       = aws_iam_role.alb_controller.arn
}

output "rules_service_role_arn" {
  description = "IAM role ARN for rules-service (Bedrock access)"
  value       = aws_iam_role.rules_service.arn
}
