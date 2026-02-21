output "cluster_name" {
  description = "EKS cluster name"
  value       = data.aws_eks_cluster.main.name
}

output "cluster_endpoint" {
  description = "EKS cluster API endpoint"
  value       = data.aws_eks_cluster.main.endpoint
  sensitive   = true
}

output "namespace" {
  description = "Kubernetes namespace for rating-platform"
  value       = kubernetes_namespace.main.metadata[0].name
}

output "ecr_repository_urls" {
  description = "ECR repository URLs for each service"
  value = {
    core-rating     = aws_ecr_repository.core_rating.repository_url
    line-rating     = aws_ecr_repository.line_rating.repository_url
    product-config  = aws_ecr_repository.product_config.repository_url
    transform       = aws_ecr_repository.transform.repository_url
    rules-service   = aws_ecr_repository.rules_service.repository_url
    status-service  = aws_ecr_repository.status_service.repository_url
    rating-workspace = aws_ecr_repository.rating_workspace.repository_url
  }
}

output "ecr_registry" {
  description = "ECR registry URL (account + region) for docker push"
  value       = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${data.aws_region.current.name}.amazonaws.com"
}
