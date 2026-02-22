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
  description = "VPC ID where ECS and RDS will run"
  type        = string
  default     = "vpc-066faf68d1d601ae1"
}

variable "private_subnet_ids" {
  description = "Private subnet IDs (ECS tasks, RDS)"
  type        = list(string)
  default     = ["subnet-09792aa52eeb823dd", "subnet-0c7d9e6f7078ccebe"]
}

variable "public_subnet_ids" {
  description = "Public subnet IDs (ALB)"
  type        = list(string)
  default     = ["subnet-027dee2920912548d", "subnet-0e9cfb87ba30b4fbd"]
}

# ── ECS ──────────────────────────────────────────────────────────────────────

variable "ecs_cluster_name" {
  description = "ECS cluster name. Uses existing cluster by default."
  type        = string
  default     = "sre-poc-mcp-cluster"
}

variable "service_discovery_namespace" {
  description = "Private DNS namespace for Cloud Map service discovery"
  type        = string
  default     = "rating-platform.local"
}

# ── Application ──────────────────────────────────────────────────────────────

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

variable "desired_count" {
  description = "Default desired task count for each ECS service"
  type        = number
  default     = 1
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
  default     = "db.t3.micro"
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
  description = "PostgreSQL username"
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
  description = "Create ALB for external traffic"
  type        = bool
  default     = true
}

variable "ingress_scheme" {
  description = "ALB scheme: internet-facing or internal"
  type        = string
  default     = "internet-facing"
}

variable "domain_name" {
  description = "Public domain (e.g. rating.example.com). Empty = HTTP only."
  type        = string
  default     = ""
}

variable "acm_certificate_arn" {
  description = "ARN of an existing ACM certificate for HTTPS. Empty = HTTP only."
  type        = string
  default     = ""
}
