# ── AWS identity / region ─────────────────────────────────────────────────────

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# ── EKS cluster (existing) ────────────────────────────────────────────────────
# Only used when create_eks_cluster = false (importing an existing cluster).

data "aws_eks_cluster" "main" {
  count = var.create_eks_cluster ? 0 : 1
  name  = var.cluster_name
}

# Auth token for existing cluster
data "aws_eks_cluster_auth" "existing" {
  count = var.create_eks_cluster ? 0 : 1
  name  = var.cluster_name
}

# Auth token for newly-created cluster (depends_on ensures cluster exists first)
data "aws_eks_cluster_auth" "created" {
  count      = var.create_eks_cluster ? 1 : 0
  name       = aws_eks_cluster.main[0].name
  depends_on = [aws_eks_cluster.main]
}

# ── EKS OIDC provider (for IRSA) ─────────────────────────────────────────────

data "tls_certificate" "eks_oidc" {
  count = var.create_eks_cluster ? 1 : 0
  url   = aws_eks_cluster.main[0].identity[0].oidc[0].issuer
}
