# ── ECS Task Execution Role ───────────────────────────────────────────────────
# Allows ECS agent to pull images from ECR, push logs to CloudWatch, and
# retrieve secrets from Secrets Manager / SSM.

resource "aws_iam_role" "ecs_task_execution" {
  name = "rating-platform-ecs-exec-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = { Environment = var.environment }
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# ── Default Task Role ────────────────────────────────────────────────────────
# Used by product-config and others. Bedrock via IAM task role (no AK/SK in AWS).
# Optional: Secrets Manager policy for USE_AWS_SECRETS_MANAGER=true (e.g. CI).

resource "aws_iam_role" "ecs_task_default" {
  name = "rating-platform-ecs-task-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = { Environment = var.environment }
}

# Bedrock: product-config uses task role (no AK/SK) when AWS_REGION is set in ECS
resource "aws_iam_role_policy" "ecs_task_default_bedrock" {
  name = "bedrock-access"
  role = aws_iam_role.ecs_task_default.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream",
        "bedrock:ListFoundationModels"
      ]
      Resource = "*"
    }]
  })
}

resource "aws_iam_role_policy" "ecs_task_default_secrets" {
  name = "secrets-manager-aws-credentials"
  role = aws_iam_role.ecs_task_default.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "secretsmanager:GetSecretValue"
      Resource = aws_secretsmanager_secret.aws_credentials.arn
    }]
  })
}

# ── Rules-Service Task Role (Bedrock access) ─────────────────────────────────

resource "aws_iam_role" "ecs_task_rules_service" {
  name = "rating-platform-rules-svc-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = { Environment = var.environment }
}

resource "aws_iam_role_policy" "rules_service_bedrock" {
  name = "bedrock-access"
  role = aws_iam_role.ecs_task_rules_service.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream",
        "bedrock:ListFoundationModels"
      ]
      Resource = "*"
    }]
  })
}

# Allow rules-service to load AWS credentials from Secrets Manager when in AWS env
resource "aws_iam_role_policy" "rules_service_secrets" {
  name = "secrets-manager-aws-credentials"
  role = aws_iam_role.ecs_task_rules_service.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "secretsmanager:GetSecretValue"
      Resource = aws_secretsmanager_secret.aws_credentials.arn
    }]
  })
}
