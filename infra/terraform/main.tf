terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Backend config supplied at init (e.g. -backend-config=bucket=...). Required for CI.
  backend "s3" {}
}

locals {
  effective_db_host = var.create_rds ? try(aws_db_instance.main[0].address, "") : var.db_host
  ecr_registry      = var.ecr_registry_id != "" ? "${var.ecr_registry_id}.dkr.ecr.${var.aws_region}.amazonaws.com" : "${data.aws_caller_identity.current.account_id}.dkr.ecr.${data.aws_region.current.name}.amazonaws.com"

  sd_namespace = var.service_discovery_namespace

  common_env = [
    { name = "NODE_ENV", value = "production" },
    { name = "LINE_RATING_URL", value = "http://line-rating.${local.sd_namespace}:4001" },
    { name = "STATUS_SERVICE_URL", value = "http://status-service.${local.sd_namespace}:4013" },
    { name = "TRANSFORM_SERVICE_URL", value = "http://transform-service.${local.sd_namespace}:4011" },
    { name = "RULES_SERVICE_URL", value = "http://rules-service.${local.sd_namespace}:4012" },
    { name = "PRODUCT_CONFIG_URL", value = "http://product-config.${local.sd_namespace}:4010" },
    { name = "ADAPTER_KAFKA_URL", value = "http://adapter-kafka.${local.sd_namespace}:3010" },
    { name = "ADAPTER_DNB_URL", value = "http://adapter-dnb.${local.sd_namespace}:3011" },
    { name = "ADAPTER_GW_URL", value = "http://adapter-gw.${local.sd_namespace}:3012" },
  ]

  db_env = local.effective_db_host != "" ? [
    { name = "DB_HOST", value = local.effective_db_host },
    { name = "DB_PORT", value = var.db_port },
    { name = "DB_NAME", value = var.db_name },
    { name = "DB_USER", value = var.db_user },
    { name = "DB_PASS", value = var.db_password },
  ] : []
}

provider "aws" {
  region = var.aws_region
}
