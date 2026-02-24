# ── Application Load Balancer ─────────────────────────────────────────────────

resource "aws_lb" "main" {
  count              = var.ingress_enabled ? 1 : 0
  name               = "rating-platform-${var.environment}"
  internal           = var.ingress_scheme == "internal"
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb[0].id]
  subnets            = var.public_subnet_ids

  tags = {
    Name        = "rating-platform-${var.environment}"
    Environment = var.environment
  }
}

# ── Target Groups ────────────────────────────────────────────────────────────
# One target group per service that receives external ALB traffic.

resource "aws_lb_target_group" "frontend" {
  count       = var.ingress_enabled ? 1 : 0
  name        = "rp-frontend-${var.environment}"
  port        = 80
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    path                = "/"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 5
    matcher             = "200"
  }

  tags = { Environment = var.environment }
}

resource "aws_lb_target_group" "core_rating" {
  count       = var.ingress_enabled ? 1 : 0
  name        = "rp-core-rating-${var.environment}"
  port        = 4000
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    path                = "/api/v1/health"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 5
    matcher             = "200"
  }

  tags = { Environment = var.environment }
}

resource "aws_lb_target_group" "line_rating" {
  count       = var.ingress_enabled ? 1 : 0
  name        = "rp-line-rating-${var.environment}"
  port        = 4001
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    path                = "/api/v1/health"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 5
    matcher             = "200"
  }

  tags = { Environment = var.environment }
}

resource "aws_lb_target_group" "product_config" {
  count       = var.ingress_enabled ? 1 : 0
  name        = "rp-product-config-${var.environment}"
  port        = 4010
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    path                = "/api/v1/health"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 5
    matcher             = "200"
  }

  tags = { Environment = var.environment }
}

resource "aws_lb_target_group" "transform_service" {
  count       = var.ingress_enabled ? 1 : 0
  name        = "rp-transform-${var.environment}"
  port        = 4011
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    path                = "/api/v1/health"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 5
    matcher             = "200"
  }

  tags = { Environment = var.environment }
}

resource "aws_lb_target_group" "rules_service" {
  count       = var.ingress_enabled ? 1 : 0
  name        = "rp-rules-svc-${var.environment}"
  port        = 4012
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    path                = "/api/v1/health"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 5
    matcher             = "200"
  }

  tags = { Environment = var.environment }
}

resource "aws_lb_target_group" "status_service" {
  count       = var.ingress_enabled ? 1 : 0
  name        = "rp-status-svc-${var.environment}"
  port        = 4013
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    path                = "/api/v1/health"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 5
    matcher             = "200"
  }

  tags = { Environment = var.environment }
}

# ── HTTP Listener ────────────────────────────────────────────────────────────

resource "aws_lb_listener" "http" {
  count             = var.ingress_enabled ? 1 : 0
  load_balancer_arn = aws_lb.main[0].arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend[0].arn
  }
}

# ── HTTPS Listener (only when ACM cert is provided) ─────────────────────────

resource "aws_lb_listener" "https" {
  count             = var.ingress_enabled && var.acm_certificate_arn != "" ? 1 : 0
  load_balancer_arn = aws_lb.main[0].arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.acm_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend[0].arn
  }
}

# HTTP → HTTPS redirect (only when HTTPS is active)
resource "aws_lb_listener_rule" "http_redirect" {
  count        = var.ingress_enabled && var.acm_certificate_arn != "" ? 1 : 0
  listener_arn = aws_lb_listener.http[0].arn
  priority     = 1

  action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }

  condition {
    path_pattern { values = ["/*"] }
  }
}

# ── Path-based Listener Rules (on HTTP listener; or HTTPS when available) ────
# More specific paths first (higher priority = lower number).

locals {
  active_listener_arn = var.acm_certificate_arn != "" ? (
    var.ingress_enabled ? aws_lb_listener.https[0].arn : ""
  ) : (var.ingress_enabled ? aws_lb_listener.http[0].arn : "")
}

resource "aws_lb_listener_rule" "orchestrators" {
  count        = var.ingress_enabled ? 1 : 0
  listener_arn = local.active_listener_arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.line_rating[0].arn
  }

  condition {
    path_pattern {
      values = [
        "/api/v1/orchestrators", "/api/v1/orchestrators/*",
        "/api/v1/custom-flows", "/api/v1/custom-flows/*",
      ]
    }
  }
}

resource "aws_lb_listener_rule" "transactions" {
  count        = var.ingress_enabled ? 1 : 0
  listener_arn = local.active_listener_arn
  priority     = 20

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.status_service[0].arn
  }

  condition {
    path_pattern { values = ["/api/v1/transactions", "/api/v1/transactions/*"] }
  }
}

resource "aws_lb_listener_rule" "transform" {
  count        = var.ingress_enabled ? 1 : 0
  listener_arn = local.active_listener_arn
  priority     = 30

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.transform_service[0].arn
  }

  condition {
    path_pattern { values = ["/api/v1/transform", "/api/v1/transform/*"] }
  }
}

resource "aws_lb_listener_rule" "rules" {
  count        = var.ingress_enabled ? 1 : 0
  listener_arn = local.active_listener_arn
  priority     = 40

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.rules_service[0].arn
  }

  condition {
    path_pattern { values = ["/api/v1/rules", "/api/v1/rules/*", "/api/v1/ai-prompts", "/api/v1/ai-prompts/*"] }
  }
}

# ALB allows max 5 path patterns per rule; product_config has 10 paths → split into 2 rules
resource "aws_lb_listener_rule" "product_config" {
  count        = var.ingress_enabled ? 1 : 0
  listener_arn = local.active_listener_arn
  priority     = 50

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.product_config[0].arn
  }

  condition {
    path_pattern {
      values = [
        "/api/v1/product-lines", "/api/v1/product-lines/*",
        "/api/v1/mappings", "/api/v1/mappings/*",
        "/api/v1/lookup-tables",
      ]
    }
  }
}

resource "aws_lb_listener_rule" "product_config_2" {
  count        = var.ingress_enabled ? 1 : 0
  listener_arn = local.active_listener_arn
  priority     = 51

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.product_config[0].arn
  }

  condition {
    path_pattern {
      values = [
        "/api/v1/lookup-tables/*",
        "/api/v1/systems", "/api/v1/systems/*",
        "/api/v1/scopes", "/api/v1/scopes/*",
      ]
    }
  }
}

resource "aws_lb_listener_rule" "product_config_db_health" {
  count        = var.ingress_enabled ? 1 : 0
  listener_arn = local.active_listener_arn
  priority     = 52

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.product_config[0].arn
  }

  condition {
    path_pattern { values = ["/api/v1/db-health"] }
  }
}

resource "aws_lb_listener_rule" "core_api" {
  count        = var.ingress_enabled ? 1 : 0
  listener_arn = local.active_listener_arn
  priority     = 90

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.core_rating[0].arn
  }

  condition {
    path_pattern { values = ["/api/v1", "/api/v1/*"] }
  }
}
