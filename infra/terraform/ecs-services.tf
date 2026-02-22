# ── ECS Fargate Services ──────────────────────────────────────────────────────
# 10 services: 7 backend + 3 adapters + 1 frontend (frontend = static Nginx)
#
# Service discovery: each service registers as <name>.rating-platform.local
# so inter-service traffic uses DNS (e.g. http://line-rating.rating-platform.local:4001)

locals {
  services = {
    core-rating = {
      image  = "rating-platform/core-rating"
      port   = 4000
      cpu    = 512
      memory = 1024
      health = "/api/v1/health"
      env    = concat(local.common_env, local.db_env, [{ name = "PORT", value = "4000" }])
      task_role_arn = aws_iam_role.ecs_task_default.arn
    }
    line-rating = {
      image  = "rating-platform/line-rating"
      port   = 4001
      cpu    = 256
      memory = 512
      health = "/api/v1/health"
      env    = concat(local.common_env, local.db_env, [{ name = "PORT", value = "4001" }])
      task_role_arn = aws_iam_role.ecs_task_default.arn
    }
    product-config = {
      image  = "rating-platform/product-config"
      port   = 4010
      cpu    = 256
      memory = 512
      health = "/api/v1/health"
      env    = concat(local.common_env, local.db_env, [{ name = "PORT", value = "4010" }])
      task_role_arn = aws_iam_role.ecs_task_default.arn
    }
    transform-service = {
      image  = "rating-platform/transform-service"
      port   = 4011
      cpu    = 256
      memory = 512
      health = "/api/v1/health"
      env    = concat(local.common_env, [{ name = "PORT", value = "4011" }])
      task_role_arn = aws_iam_role.ecs_task_default.arn
    }
    rules-service = {
      image  = "rating-platform/rules-service"
      port   = 4012
      cpu    = 512
      memory = 1024
      health = "/api/v1/health"
      env = concat(local.common_env, local.db_env, [
        { name = "PORT", value = "4012" },
        { name = "AWS_REGION", value = var.aws_region },
      ])
      task_role_arn = aws_iam_role.ecs_task_rules_service.arn
    }
    status-service = {
      image  = "rating-platform/status-service"
      port   = 4013
      cpu    = 256
      memory = 512
      health = "/api/v1/health"
      env    = concat(local.common_env, local.db_env, [{ name = "PORT", value = "4013" }])
      task_role_arn = aws_iam_role.ecs_task_default.arn
    }
    adapter-kafka = {
      image  = "rating-platform/adapter-kafka"
      port   = 3010
      cpu    = 256
      memory = 512
      health = "/api/v1/health"
      env    = concat(local.common_env, [{ name = "PORT", value = "3010" }])
      task_role_arn = aws_iam_role.ecs_task_default.arn
    }
    adapter-dnb = {
      image  = "rating-platform/adapter-dnb"
      port   = 3011
      cpu    = 256
      memory = 512
      health = "/api/v1/health"
      env    = concat(local.common_env, [{ name = "PORT", value = "3011" }])
      task_role_arn = aws_iam_role.ecs_task_default.arn
    }
    adapter-gw = {
      image  = "rating-platform/adapter-gw"
      port   = 3012
      cpu    = 256
      memory = 512
      health = "/api/v1/health"
      env    = concat(local.common_env, [{ name = "PORT", value = "3012" }])
      task_role_arn = aws_iam_role.ecs_task_default.arn
    }
    rating-workspace = {
      image  = "rating-platform/rating-workspace"
      port   = 80
      cpu    = 256
      memory = 512
      health = "/"
      env    = []
      task_role_arn = aws_iam_role.ecs_task_default.arn
    }
  }
}

# ── Service Discovery entries ────────────────────────────────────────────────

resource "aws_service_discovery_service" "services" {
  for_each = local.services

  name = each.key

  dns_config {
    namespace_id   = aws_service_discovery_private_dns_namespace.main.id
    routing_policy = "MULTIVALUE"

    dns_records {
      ttl  = 10
      type = "A"
    }
  }

  health_check_custom_config {
    failure_threshold = 1
  }
}

# ── Task Definitions ─────────────────────────────────────────────────────────

resource "aws_ecs_task_definition" "services" {
  for_each = local.services

  family                   = "rp-${each.key}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = each.value.cpu
  memory                   = each.value.memory
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = each.value.task_role_arn

  container_definitions = jsonencode([{
    name      = each.key
    image     = "${local.ecr_registry}/${each.value.image}:${var.image_tag}"
    essential = true

    portMappings = [{
      containerPort = each.value.port
      protocol      = "tcp"
    }]

    environment = each.value.env

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = each.key
      }
    }

    healthCheck = {
      command     = ["CMD-SHELL", "curl -f http://localhost:${each.value.port}${each.value.health} || exit 1"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 15
    }
  }])

  tags = {
    Environment = var.environment
    Service     = each.key
  }
}

# ── ECS Services ─────────────────────────────────────────────────────────────

resource "aws_ecs_service" "services" {
  for_each = local.services

  name            = each.key
  cluster         = data.aws_ecs_cluster.main.arn
  task_definition = aws_ecs_task_definition.services[each.key].arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  service_registries {
    registry_arn = aws_service_discovery_service.services[each.key].arn
  }

  dynamic "load_balancer" {
    for_each = var.ingress_enabled && contains(keys(local.alb_target_groups), each.key) ? [1] : []
    content {
      target_group_arn = local.alb_target_groups[each.key]
      container_name   = each.key
      container_port   = each.value.port
    }
  }

  depends_on = [aws_lb_listener.http]

  lifecycle {
    ignore_changes = [desired_count]
  }

  tags = {
    Environment = var.environment
    Service     = each.key
  }
}

# Map of services that need ALB target group attachments
locals {
  alb_target_groups = var.ingress_enabled ? {
    "rating-workspace"  = aws_lb_target_group.frontend[0].arn
    "core-rating"       = aws_lb_target_group.core_rating[0].arn
    "line-rating"       = aws_lb_target_group.line_rating[0].arn
    "product-config"    = aws_lb_target_group.product_config[0].arn
    "transform-service" = aws_lb_target_group.transform_service[0].arn
    "rules-service"     = aws_lb_target_group.rules_service[0].arn
    "status-service"    = aws_lb_target_group.status_service[0].arn
  } : {}
}
