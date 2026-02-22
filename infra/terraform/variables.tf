# ── AWS ──────────────────────────────────────────────────────────────────────

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (dev | staging | prod)"
  type        = string
  default     = "dev"
}

# ── Networking ────────────────────────────────────────────────────────────────

variable "vpc_id" {
  description = "VPC ID where EKS and RDS will run"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs (EKS nodes, RDS)"
  type        = list(string)
}

variable "public_subnet_ids" {
  description = "Public subnet IDs (ALB)"
  type        = list(string)
}

# ── EKS ───────────────────────────────────────────────────────────────────────

variable "cluster_name" {
  description = "EKS cluster name. If create_eks_cluster=true this is created; otherwise must already exist."
  type        = string
}

variable "create_eks_cluster" {
  description = "Set to true to provision the EKS cluster via Terraform. False = use existing cluster."
  type        = bool
  default     = false
}

variable "eks_kubernetes_version" {
  description = "Kubernetes version for the EKS cluster"
  type        = string
  default     = "1.29"
}

variable "eks_node_instance_type" {
  description = "EC2 instance type for EKS managed node group"
  type        = string
  default     = "t3.medium"
}

variable "eks_node_desired_size" {
  description = "Desired number of EKS worker nodes"
  type        = number
  default     = 2
}

variable "eks_node_min_size" {
  description = "Minimum number of EKS worker nodes"
  type        = number
  default     = 1
}

variable "eks_node_max_size" {
  description = "Maximum number of EKS worker nodes"
  type        = number
  default     = 4
}

# ── Kubernetes / Application ──────────────────────────────────────────────────

variable "namespace" {
  description = "Kubernetes namespace for rating-platform workloads"
  type        = string
  default     = "rating-platform"
}

variable "image_tag" {
  description = "Docker image tag applied to all services"
  type        = string
  default     = "latest"
}

variable "ecr_registry_id" {
  description = "AWS account ID for ECR. Leave empty to auto-detect."
  type        = string
  default     = ""
}

# ── Database (RDS PostgreSQL) ──────────────────────────────────────────────────

variable "create_rds" {
  description = "Set to true to create an RDS PostgreSQL instance."
  type        = bool
  default     = true
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "db_allocated_storage" {
  description = "RDS allocated storage in GB"
  type        = number
  default     = 20
}

variable "db_host" {
  description = "External PostgreSQL host (used when create_rds=false)"
  type        = string
  default     = ""
}

variable "db_port" {
  description = "PostgreSQL port"
  type        = string
  default     = "5432"
}

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "rating_platform"
}

variable "db_user" {
  description = "PostgreSQL username (sensitive)"
  type        = string
  default     = "rating_user"
  sensitive   = true
}

variable "db_password" {
  description = "PostgreSQL password (sensitive)"
  type        = string
  default     = ""
  sensitive   = true
}

# ── Ingress / TLS ─────────────────────────────────────────────────────────────

variable "ingress_enabled" {
  description = "Create Kubernetes Ingress resource"
  type        = bool
  default     = true
}

variable "ingress_class_name" {
  description = "Ingress class name (alb | nginx)"
  type        = string
  default     = "alb"
}

variable "domain_name" {
  description = "Public domain (e.g. rating.example.com). Used for Ingress host and ACM cert. Empty = HTTP only."
  type        = string
  default     = ""
}

variable "acm_certificate_arn" {
  description = "ARN of an existing ACM certificate. If empty and domain_name is set, a new cert is requested."
  type        = string
  default     = ""
}

variable "ingress_scheme" {
  description = "ALB scheme: internet-facing or internal"
  type        = string
  default     = "internet-facing"
}

# ── Scaling ───────────────────────────────────────────────────────────────────

variable "enable_hpa" {
  description = "Enable Horizontal Pod Autoscaler for key services"
  type        = bool
  default     = true
}

variable "hpa_min_replicas" {
  description = "Minimum pod replicas (HPA)"
  type        = number
  default     = 2
}

variable "hpa_max_replicas" {
  description = "Maximum pod replicas (HPA)"
  type        = number
  default     = 6
}
