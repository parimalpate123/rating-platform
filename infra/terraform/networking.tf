# ── Security Groups ───────────────────────────────────────────────────────────
# Only created when we provision EKS / RDS (create_eks_cluster = true or create_rds = true).

# ALB security group — internet-facing 80/443
resource "aws_security_group" "alb" {
  count       = var.create_eks_cluster ? 1 : 0
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

# EKS node security group — allow inter-node + ALB → node traffic
resource "aws_security_group" "eks_nodes" {
  count       = var.create_eks_cluster ? 1 : 0
  name        = "rating-platform-eks-nodes-${var.environment}"
  description = "EKS worker nodes"
  vpc_id      = var.vpc_id

  # Allow all intra-cluster traffic
  ingress {
    from_port = 0
    to_port   = 0
    protocol  = "-1"
    self      = true
  }

  # Allow ALB to reach node ports (30000–32767) and any target port
  ingress {
    from_port       = 0
    to_port         = 0
    protocol        = "-1"
    security_groups = [aws_security_group.alb[0].id]
  }

  # Allow all egress (internet, ECR, RDS, AWS APIs)
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name                                                   = "rating-platform-eks-nodes-${var.environment}"
    Environment                                            = var.environment
    "kubernetes.io/cluster/${var.cluster_name}"            = "owned"
  }
}

# RDS security group — only EKS nodes can reach PostgreSQL
resource "aws_security_group" "rds" {
  count       = var.create_rds ? 1 : 0
  name        = "rating-platform-rds-${var.environment}"
  description = "RDS: allow PostgreSQL from EKS nodes only"
  vpc_id      = var.vpc_id

  ingress {
    from_port = 5432
    to_port   = 5432
    protocol  = "tcp"
    # If we created the EKS SG, restrict to it; otherwise open to private subnets
    security_groups = var.create_eks_cluster ? [aws_security_group.eks_nodes[0].id] : []
    cidr_blocks     = var.create_eks_cluster ? [] : ["10.0.0.0/8"]
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
