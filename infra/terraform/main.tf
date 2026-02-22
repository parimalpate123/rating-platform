terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.12"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }

  # Uncomment and configure for remote state (recommended for team use):
  # backend "s3" {
  #   bucket         = "your-terraform-state-bucket"
  #   key            = "rating-platform/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "terraform-locks"
  #   encrypt        = true
  # }
}

# ── Locals: unified cluster access (supports both create and import modes) ────

locals {
  # Cluster endpoint/CA/token — use try() because only one count branch exists at a time
  eks_endpoint = var.create_eks_cluster ? try(aws_eks_cluster.main[0].endpoint, "") : try(data.aws_eks_cluster.main[0].endpoint, "")
  eks_ca_cert  = var.create_eks_cluster ? try(aws_eks_cluster.main[0].certificate_authority[0].data, "") : try(data.aws_eks_cluster.main[0].certificate_authority[0].data, "")
  eks_token    = var.create_eks_cluster ? try(data.aws_eks_cluster_auth.created[0].token, "") : try(data.aws_eks_cluster_auth.existing[0].token, "")

  # Effective DB host: use RDS endpoint if we created it, else use variable
  effective_db_host = var.create_rds ? try(aws_db_instance.main[0].address, "") : var.db_host

  # ECR registry base
  ecr_registry = var.ecr_registry_id != "" ? "${var.ecr_registry_id}.dkr.ecr.${var.aws_region}.amazonaws.com" : "${data.aws_caller_identity.current.account_id}.dkr.ecr.${data.aws_region.current.name}.amazonaws.com"
}

# ── Providers ─────────────────────────────────────────────────────────────────

provider "aws" {
  region = var.aws_region
}

provider "kubernetes" {
  host                   = local.eks_endpoint
  cluster_ca_certificate = base64decode(local.eks_ca_cert)
  token                  = local.eks_token
}

provider "helm" {
  kubernetes {
    host                   = local.eks_endpoint
    cluster_ca_certificate = base64decode(local.eks_ca_cert)
    token                  = local.eks_token
  }
}
