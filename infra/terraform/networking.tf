# ── Security Groups ───────────────────────────────────────────────────────────

# ALB security group — internet-facing 80/443
resource "aws_security_group" "alb" {
  count       = var.ingress_enabled ? 1 : 0
  name        = "rating-platform-alb-${var.environment}"
  description = "ALB: allow HTTP/HTTPS from internet"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "rating-platform-alb-${var.environment}"
    Environment = var.environment
  }
}

# ECS tasks security group — allow ALB to reach container ports
resource "aws_security_group" "ecs_tasks" {
  name        = "rating-platform-ecs-tasks-${var.environment}"
  description = "ECS Fargate tasks: ALB ingress + inter-service traffic"
  vpc_id      = var.vpc_id

  # Allow all traffic from ALB
  dynamic "ingress" {
    for_each = var.ingress_enabled ? [1] : []
    content {
      from_port       = 0
      to_port         = 65535
      protocol        = "tcp"
      security_groups = [aws_security_group.alb[0].id]
    }
  }

  # Allow inter-service traffic (tasks in same SG)
  ingress {
    from_port = 0
    to_port   = 65535
    protocol  = "tcp"
    self      = true
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "rating-platform-ecs-tasks-${var.environment}"
    Environment = var.environment
  }
}

# RDS security group — only ECS tasks can reach PostgreSQL
resource "aws_security_group" "rds" {
  count       = var.create_rds ? 1 : 0
  name        = "rating-platform-rds-${var.environment}"
  description = "RDS: allow PostgreSQL from ECS tasks only"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "rating-platform-rds-${var.environment}"
    Environment = var.environment
  }
}
