variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "cluster_name" {
  description = "Name of the existing EKS cluster"
  type        = string
}

variable "environment" {
  description = "Environment name (e.g. dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "namespace" {
  description = "Kubernetes namespace for rating-platform"
  type        = string
  default     = "rating-platform"
}

# Database: use existing Postgres. Set these or use a K8s Secret created elsewhere.
variable "db_host" {
  description = "PostgreSQL host (e.g. RDS endpoint)"
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
  description = "PostgreSQL user (sensitive - prefer passing via TF_VAR or secret)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "db_password" {
  description = "PostgreSQL password (sensitive)"
  type        = string
  default     = ""
  sensitive   = true
}

# Image tags for each service (optional; default 'latest')
variable "image_tag" {
  description = "Docker image tag for all services"
  type        = string
  default     = "latest"
}

variable "ecr_registry_id" {
  description = "AWS account ID (used for ECR repo URLs). Leave empty to use data.aws_caller_identity"
  type        = string
  default     = ""
}

# Ingress: expose APIs (and optionally frontend) via an Ingress controller
variable "ingress_enabled" {
  description = "Create Ingress for API and frontend"
  type        = bool
  default     = true
}

variable "ingress_class_name" {
  description = "Ingress class (e.g. alb, nginx). Set to match your cluster's Ingress controller."
  type        = string
  default     = "alb"
}
