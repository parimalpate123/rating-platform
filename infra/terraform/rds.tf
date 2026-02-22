# ── RDS PostgreSQL (optional — set create_rds = true to provision) ────────────

resource "aws_db_subnet_group" "main" {
  count      = var.create_rds ? 1 : 0
  name       = "rating-platform-${var.environment}"
  subnet_ids = var.private_subnet_ids

  tags = {
    Name        = "rating-platform-${var.environment}"
    Environment = var.environment
  }
}

resource "aws_db_instance" "main" {
  count = var.create_rds ? 1 : 0

  identifier        = "rating-platform-${var.environment}"
  engine            = "postgres"
  engine_version    = "16"
  instance_class    = var.db_instance_class
  allocated_storage = var.db_allocated_storage

  db_name  = var.db_name
  username = var.db_user
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.main[0].name
  vpc_security_group_ids = [aws_security_group.rds[0].id]

  # Backups and protection
  backup_retention_period = 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "sun:05:00-sun:06:00"
  deletion_protection     = var.environment == "prod" ? true : false
  skip_final_snapshot     = var.environment == "prod" ? false : true
  final_snapshot_identifier = var.environment == "prod" ? "rating-platform-${var.environment}-final" : null

  # Encryption
  storage_encrypted = true

  # Performance & monitoring
  performance_insights_enabled = true
  monitoring_interval          = 60

  # Networking
  multi_az            = var.environment == "prod" ? true : false
  publicly_accessible = false

  tags = {
    Name        = "rating-platform-${var.environment}"
    Environment = var.environment
  }

  lifecycle {
    prevent_destroy = false
    ignore_changes  = [password] # Managed externally after initial creation
  }
}
