data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

data "aws_eks_cluster" "main" {
  name = var.cluster_name
}

data "aws_eks_cluster_auth" "main" {
  name = var.cluster_name
}
