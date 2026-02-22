# ── CodeBuild: run DB migrations from AWS Console (inside VPC, reaches private RDS) ─

# SSM parameters so CodeBuild can read RDS endpoint without parsing Terraform output
resource "aws_ssm_parameter" "rds_endpoint" {
  count       = var.create_rds ? 1 : 0
  name        = "/rating-platform/${var.environment}/rds-endpoint"
  description = "RDS endpoint for migrations (set by Terraform)"
  type        = "String"
  value       = aws_db_instance.main[0].address
  tags        = { Environment = var.environment }
}

resource "aws_ssm_parameter" "rds_port" {
  count       = var.create_rds ? 1 : 0
  name        = "/rating-platform/${var.environment}/rds-port"
  description = "RDS port for migrations"
  type        = "String"
  value       = tostring(aws_db_instance.main[0].port)
  tags        = { Environment = var.environment }
}

# Security group for CodeBuild (egress only; needs to reach RDS and internet via NAT)
resource "aws_security_group" "codebuild_migrations" {
  count       = var.create_codebuild_migrations && var.create_rds ? 1 : 0
  name        = "rating-platform-codebuild-migrations-${var.environment}"
  description = "CodeBuild migrations job: egress to RDS and internet"
  vpc_id      = var.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "rating-platform-codebuild-migrations-${var.environment}"
    Environment = var.environment
  }
}

# Allow CodeBuild to reach RDS
resource "aws_security_group_rule" "rds_ingress_from_codebuild" {
  count                    = var.create_codebuild_migrations && var.create_rds ? 1 : 0
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  security_group_id        = aws_security_group.rds[0].id
  source_security_group_id = aws_security_group.codebuild_migrations[0].id
  description              = "PostgreSQL from CodeBuild migrations"
}

# IAM role for CodeBuild
resource "aws_iam_role" "codebuild_migrations" {
  count = var.create_codebuild_migrations && var.create_rds ? 1 : 0

  name = "rating-platform-codebuild-migrations-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "codebuild.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy" "codebuild_migrations" {
  count = var.create_codebuild_migrations && var.create_rds ? 1 : 0

  role = aws_iam_role.codebuild_migrations[0].name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [aws_secretsmanager_secret.db_credentials.arn]
      },
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters"
        ]
        Resource = [
          "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter/rating-platform/${var.environment}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = ["*"]
      },
      {
        Effect = "Allow"
        Action = [
          "ec2:DescribeSecurityGroups",
          "ec2:DescribeVpcs",
          "ec2:DescribeSubnets",
          "ec2:DescribeNetworkInterfaces",
          "ec2:CreateNetworkInterface",
          "ec2:DeleteNetworkInterface"
        ]
        Resource = ["*"]
      }
    ]
  })
}

# CodeBuild project (VPC config requires runner to have ec2:DescribeSecurityGroups, DescribeVpcs, DescribeSubnets)
resource "aws_codebuild_project" "migrations" {
  count = var.create_codebuild_migrations && var.create_rds && var.codebuild_github_repo != "" ? 1 : 0

  name          = "rating-platform-migrations-${var.environment}"
  description   = "Run DB migrations against RDS (inside VPC)"
  service_role  = aws_iam_role.codebuild_migrations[0].arn
  build_timeout = 10

  source {
    type      = "GITHUB"
    location  = var.codebuild_github_repo
    buildspec = "buildspec-migrations.yml"
  }

  artifacts {
    type = "NO_ARTIFACTS"
  }

  environment {
    type                        = "LINUX_CONTAINER"
    image                       = "aws/codebuild/standard:7.0"
    compute_type                = "BUILD_GENERAL1_SMALL"
    image_pull_credentials_type = "CODEBUILD"

    environment_variable {
      name  = "ENVIRONMENT"
      value = var.environment
    }
  }

  vpc_config {
    vpc_id             = var.vpc_id
    subnets            = var.private_subnet_ids
    security_group_ids = [aws_security_group.codebuild_migrations[0].id]
  }

  logs_config {
    cloudwatch_logs {
      group_name  = "/aws/codebuild/rating-platform-migrations-${var.environment}"
      stream_name = ""
    }
  }

  tags = {
    Environment = var.environment
  }
}
