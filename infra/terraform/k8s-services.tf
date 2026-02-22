# Remaining backend services + adapters + frontend + Ingress

locals {
  ns = kubernetes_namespace.main.metadata[0].name
}

# ── Helper: default resource block for NestJS services ───────────────────────
# Declared once, referenced per-container via resource blocks below.
# (Terraform doesn't support reusable blocks; values are inlined per service.)

# ----- line-rating (port 4001, needs DB) -----
resource "kubernetes_deployment" "line_rating" {
  metadata {
    name      = "line-rating"
    namespace = local.ns
    labels    = { app = "line-rating" }
  }
  spec {
    replicas = 1
    selector { match_labels = { app = "line-rating" } }
    template {
      metadata { labels = { app = "line-rating" } }
      spec {
        container {
          name  = "line-rating"
          image = "${local.ecr_registry}/rating-platform/line-rating:${var.image_tag}"
          port { container_port = 4001; name = "http" }
          env_from { config_map_ref { name = kubernetes_config_map.app_env.metadata[0].name } }
          dynamic "env_from" {
            for_each = kubernetes_secret.db
            content { secret_ref { name = kubernetes_secret.db[0].metadata[0].name } }
          }
          env { name = "PORT"; value = "4001" }
          resources {
            requests = { cpu = "100m"; memory = "256Mi" }
            limits   = { cpu = "500m"; memory = "512Mi" }
          }
          liveness_probe {
            http_get { path = "/api/v1/health"; port = 4001 }
            initial_delay_seconds = 15; period_seconds = 20; failure_threshold = 3
          }
          readiness_probe {
            http_get { path = "/api/v1/health"; port = 4001 }
            initial_delay_seconds = 5; period_seconds = 10; failure_threshold = 3
          }
        }
      }
    }
  }
}
resource "kubernetes_service" "line_rating" {
  metadata { name = "line-rating"; namespace = local.ns }
  spec {
    selector = { app = "line-rating" }
    port { port = 4001; target_port = 4001; name = "http" }
    type = "ClusterIP"
  }
}

# ----- product-config (port 4010, needs DB) -----
resource "kubernetes_deployment" "product_config" {
  metadata {
    name      = "product-config"
    namespace = local.ns
    labels    = { app = "product-config" }
  }
  spec {
    replicas = 1
    selector { match_labels = { app = "product-config" } }
    template {
      metadata { labels = { app = "product-config" } }
      spec {
        container {
          name  = "product-config"
          image = "${local.ecr_registry}/rating-platform/product-config:${var.image_tag}"
          port { container_port = 4010; name = "http" }
          env_from { config_map_ref { name = kubernetes_config_map.app_env.metadata[0].name } }
          dynamic "env_from" {
            for_each = kubernetes_secret.db
            content { secret_ref { name = kubernetes_secret.db[0].metadata[0].name } }
          }
          env { name = "PORT"; value = "4010" }
          resources {
            requests = { cpu = "100m"; memory = "256Mi" }
            limits   = { cpu = "500m"; memory = "512Mi" }
          }
          liveness_probe {
            http_get { path = "/api/v1/health"; port = 4010 }
            initial_delay_seconds = 15; period_seconds = 20; failure_threshold = 3
          }
          readiness_probe {
            http_get { path = "/api/v1/health"; port = 4010 }
            initial_delay_seconds = 5; period_seconds = 10; failure_threshold = 3
          }
        }
      }
    }
  }
}
resource "kubernetes_service" "product_config" {
  metadata { name = "product-config"; namespace = local.ns }
  spec {
    selector = { app = "product-config" }
    port { port = 4010; target_port = 4010; name = "http" }
    type = "ClusterIP"
  }
}

# ----- transform-service (port 4011, stateless) -----
resource "kubernetes_deployment" "transform_service" {
  metadata {
    name      = "transform-service"
    namespace = local.ns
    labels    = { app = "transform-service" }
  }
  spec {
    replicas = 1
    selector { match_labels = { app = "transform-service" } }
    template {
      metadata { labels = { app = "transform-service" } }
      spec {
        container {
          name  = "transform-service"
          image = "${local.ecr_registry}/rating-platform/transform-service:${var.image_tag}"
          port { container_port = 4011; name = "http" }
          env_from { config_map_ref { name = kubernetes_config_map.app_env.metadata[0].name } }
          env { name = "PORT"; value = "4011" }
          resources {
            requests = { cpu = "50m"; memory = "128Mi" }
            limits   = { cpu = "200m"; memory = "256Mi" }
          }
          liveness_probe {
            http_get { path = "/api/v1/health"; port = 4011 }
            initial_delay_seconds = 15; period_seconds = 20; failure_threshold = 3
          }
          readiness_probe {
            http_get { path = "/api/v1/health"; port = 4011 }
            initial_delay_seconds = 5; period_seconds = 10; failure_threshold = 3
          }
        }
      }
    }
  }
}
resource "kubernetes_service" "transform_service" {
  metadata { name = "transform-service"; namespace = local.ns }
  spec {
    selector = { app = "transform-service" }
    port { port = 4011; target_port = 4011; name = "http" }
    type = "ClusterIP"
  }
}

# ----- rules-service (port 4012, needs DB + Bedrock IRSA) -----
resource "kubernetes_deployment" "rules_service" {
  metadata {
    name      = "rules-service"
    namespace = local.ns
    labels    = { app = "rules-service" }
  }
  spec {
    replicas = 1
    selector { match_labels = { app = "rules-service" } }
    template {
      metadata {
        labels = { app = "rules-service" }
        annotations = {
          "eks.amazonaws.com/role-arn" = aws_iam_role.rules_service.arn
        }
      }
      spec {
        service_account_name = kubernetes_service_account.rules_service.metadata[0].name
        container {
          name  = "rules-service"
          image = "${local.ecr_registry}/rating-platform/rules-service:${var.image_tag}"
          port { container_port = 4012; name = "http" }
          env_from { config_map_ref { name = kubernetes_config_map.app_env.metadata[0].name } }
          dynamic "env_from" {
            for_each = kubernetes_secret.db
            content { secret_ref { name = kubernetes_secret.db[0].metadata[0].name } }
          }
          env { name = "PORT"; value = "4012" }
          env { name = "AWS_REGION"; value = var.aws_region }
          resources {
            requests = { cpu = "200m"; memory = "512Mi" }
            limits   = { cpu = "1000m"; memory = "1Gi" }
          }
          liveness_probe {
            http_get { path = "/api/v1/health"; port = 4012 }
            initial_delay_seconds = 15; period_seconds = 20; failure_threshold = 3
          }
          readiness_probe {
            http_get { path = "/api/v1/health"; port = 4012 }
            initial_delay_seconds = 5; period_seconds = 10; failure_threshold = 3
          }
        }
      }
    }
  }
}
resource "kubernetes_service" "rules_service" {
  metadata { name = "rules-service"; namespace = local.ns }
  spec {
    selector = { app = "rules-service" }
    port { port = 4012; target_port = 4012; name = "http" }
    type = "ClusterIP"
  }
}

# Service account with IRSA annotation for Bedrock
resource "kubernetes_service_account" "rules_service" {
  metadata {
    name      = "rules-service"
    namespace = local.ns
    annotations = {
      "eks.amazonaws.com/role-arn" = aws_iam_role.rules_service.arn
    }
  }
}

# ----- status-service (port 4013, needs DB) -----
resource "kubernetes_deployment" "status_service" {
  metadata {
    name      = "status-service"
    namespace = local.ns
    labels    = { app = "status-service" }
  }
  spec {
    replicas = 1
    selector { match_labels = { app = "status-service" } }
    template {
      metadata { labels = { app = "status-service" } }
      spec {
        container {
          name  = "status-service"
          image = "${local.ecr_registry}/rating-platform/status-service:${var.image_tag}"
          port { container_port = 4013; name = "http" }
          env_from { config_map_ref { name = kubernetes_config_map.app_env.metadata[0].name } }
          dynamic "env_from" {
            for_each = kubernetes_secret.db
            content { secret_ref { name = kubernetes_secret.db[0].metadata[0].name } }
          }
          env { name = "PORT"; value = "4013" }
          resources {
            requests = { cpu = "100m"; memory = "256Mi" }
            limits   = { cpu = "500m"; memory = "512Mi" }
          }
          liveness_probe {
            http_get { path = "/api/v1/health"; port = 4013 }
            initial_delay_seconds = 15; period_seconds = 20; failure_threshold = 3
          }
          readiness_probe {
            http_get { path = "/api/v1/health"; port = 4013 }
            initial_delay_seconds = 5; period_seconds = 10; failure_threshold = 3
          }
        }
      }
    }
  }
}
resource "kubernetes_service" "status_service" {
  metadata { name = "status-service"; namespace = local.ns }
  spec {
    selector = { app = "status-service" }
    port { port = 4013; target_port = 4013; name = "http" }
    type = "ClusterIP"
  }
}

# ----- adapter-kafka (port 3010, stateless mock) -----
resource "kubernetes_deployment" "adapter_kafka" {
  metadata {
    name      = "adapter-kafka"
    namespace = local.ns
    labels    = { app = "adapter-kafka" }
  }
  spec {
    replicas = 1
    selector { match_labels = { app = "adapter-kafka" } }
    template {
      metadata { labels = { app = "adapter-kafka" } }
      spec {
        container {
          name  = "adapter-kafka"
          image = "${local.ecr_registry}/rating-platform/adapter-kafka:${var.image_tag}"
          port { container_port = 3010; name = "http" }
          env_from { config_map_ref { name = kubernetes_config_map.app_env.metadata[0].name } }
          env { name = "PORT"; value = "3010" }
          resources {
            requests = { cpu = "50m"; memory = "128Mi" }
            limits   = { cpu = "200m"; memory = "256Mi" }
          }
          liveness_probe {
            http_get { path = "/api/v1/health"; port = 3010 }
            initial_delay_seconds = 10; period_seconds = 20; failure_threshold = 3
          }
          readiness_probe {
            http_get { path = "/api/v1/health"; port = 3010 }
            initial_delay_seconds = 5; period_seconds = 10; failure_threshold = 3
          }
        }
      }
    }
  }
}
resource "kubernetes_service" "adapter_kafka" {
  metadata { name = "adapter-kafka"; namespace = local.ns }
  spec {
    selector = { app = "adapter-kafka" }
    port { port = 3010; target_port = 3010; name = "http" }
    type = "ClusterIP"
  }
}

# ----- adapter-dnb (port 3011, stateless mock) -----
resource "kubernetes_deployment" "adapter_dnb" {
  metadata {
    name      = "adapter-dnb"
    namespace = local.ns
    labels    = { app = "adapter-dnb" }
  }
  spec {
    replicas = 1
    selector { match_labels = { app = "adapter-dnb" } }
    template {
      metadata { labels = { app = "adapter-dnb" } }
      spec {
        container {
          name  = "adapter-dnb"
          image = "${local.ecr_registry}/rating-platform/adapter-dnb:${var.image_tag}"
          port { container_port = 3011; name = "http" }
          env_from { config_map_ref { name = kubernetes_config_map.app_env.metadata[0].name } }
          env { name = "PORT"; value = "3011" }
          resources {
            requests = { cpu = "50m"; memory = "128Mi" }
            limits   = { cpu = "200m"; memory = "256Mi" }
          }
          liveness_probe {
            http_get { path = "/api/v1/health"; port = 3011 }
            initial_delay_seconds = 10; period_seconds = 20; failure_threshold = 3
          }
          readiness_probe {
            http_get { path = "/api/v1/health"; port = 3011 }
            initial_delay_seconds = 5; period_seconds = 10; failure_threshold = 3
          }
        }
      }
    }
  }
}
resource "kubernetes_service" "adapter_dnb" {
  metadata { name = "adapter-dnb"; namespace = local.ns }
  spec {
    selector = { app = "adapter-dnb" }
    port { port = 3011; target_port = 3011; name = "http" }
    type = "ClusterIP"
  }
}

# ----- adapter-gw (port 3012, stateless mock) -----
resource "kubernetes_deployment" "adapter_gw" {
  metadata {
    name      = "adapter-gw"
    namespace = local.ns
    labels    = { app = "adapter-gw" }
  }
  spec {
    replicas = 1
    selector { match_labels = { app = "adapter-gw" } }
    template {
      metadata { labels = { app = "adapter-gw" } }
      spec {
        container {
          name  = "adapter-gw"
          image = "${local.ecr_registry}/rating-platform/adapter-gw:${var.image_tag}"
          port { container_port = 3012; name = "http" }
          env_from { config_map_ref { name = kubernetes_config_map.app_env.metadata[0].name } }
          env { name = "PORT"; value = "3012" }
          resources {
            requests = { cpu = "50m"; memory = "128Mi" }
            limits   = { cpu = "200m"; memory = "256Mi" }
          }
          liveness_probe {
            http_get { path = "/api/v1/health"; port = 3012 }
            initial_delay_seconds = 10; period_seconds = 20; failure_threshold = 3
          }
          readiness_probe {
            http_get { path = "/api/v1/health"; port = 3012 }
            initial_delay_seconds = 5; period_seconds = 10; failure_threshold = 3
          }
        }
      }
    }
  }
}
resource "kubernetes_service" "adapter_gw" {
  metadata { name = "adapter-gw"; namespace = local.ns }
  spec {
    selector = { app = "adapter-gw" }
    port { port = 3012; target_port = 3012; name = "http" }
    type = "ClusterIP"
  }
}

# ----- rating-workspace (frontend, port 80) -----
resource "kubernetes_deployment" "rating_workspace" {
  metadata {
    name      = "rating-workspace"
    namespace = local.ns
    labels    = { app = "rating-workspace" }
  }
  spec {
    replicas = 1
    selector { match_labels = { app = "rating-workspace" } }
    template {
      metadata { labels = { app = "rating-workspace" } }
      spec {
        container {
          name  = "rating-workspace"
          image = "${local.ecr_registry}/rating-platform/rating-workspace:${var.image_tag}"
          port { container_port = 80; name = "http" }
          resources {
            requests = { cpu = "50m"; memory = "64Mi" }
            limits   = { cpu = "200m"; memory = "256Mi" }
          }
          liveness_probe {
            http_get { path = "/"; port = 80 }
            initial_delay_seconds = 10; period_seconds = 20; failure_threshold = 3
          }
          readiness_probe {
            http_get { path = "/"; port = 80 }
            initial_delay_seconds = 5; period_seconds = 10; failure_threshold = 3
          }
        }
      }
    }
  }
}
resource "kubernetes_service" "rating_workspace" {
  metadata { name = "rating-workspace"; namespace = local.ns }
  spec {
    selector = { app = "rating-workspace" }
    port { port = 80; target_port = 80; name = "http" }
    type = "ClusterIP"
  }
}

# ----- Ingress (ALB, path-based routing, optional TLS) -----
resource "kubernetes_ingress_v1" "main" {
  count = var.ingress_enabled ? 1 : 0

  metadata {
    name      = "rating-platform"
    namespace = local.ns
    annotations = merge(
      {
        "kubernetes.io/ingress.class"               = var.ingress_class_name
        "alb.ingress.kubernetes.io/scheme"          = var.ingress_scheme
        "alb.ingress.kubernetes.io/target-type"     = "ip"
        "alb.ingress.kubernetes.io/listen-ports"    = var.acm_certificate_arn != "" ? "[{\"HTTP\":80},{\"HTTPS\":443}]" : "[{\"HTTP\":80}]"
        "alb.ingress.kubernetes.io/ssl-redirect"    = var.acm_certificate_arn != "" ? "443" : ""
        "alb.ingress.kubernetes.io/healthcheck-path" = "/api/v1/health"
      },
      var.acm_certificate_arn != "" ? {
        "alb.ingress.kubernetes.io/certificate-arn" = var.acm_certificate_arn
      } : {}
    )
  }

  spec {
    ingress_class_name = var.ingress_class_name

    dynamic "rule" {
      for_each = var.domain_name != "" ? [var.domain_name] : [""]
      content {
        host = rule.value != "" ? rule.value : null
        http {
          path {
            path      = "/api/v1/orchestrators"
            path_type = "Prefix"
            backend {
              service {
                name = kubernetes_service.line_rating.metadata[0].name
                port { number = 4001 }
              }
            }
          }
          path {
            path      = "/api/v1/transactions"
            path_type = "Prefix"
            backend {
              service {
                name = kubernetes_service.status_service.metadata[0].name
                port { number = 4013 }
              }
            }
          }
          path {
            path      = "/api/v1/transform"
            path_type = "Prefix"
            backend {
              service {
                name = kubernetes_service.transform_service.metadata[0].name
                port { number = 4011 }
              }
            }
          }
          path {
            path      = "/api/v1/rules"
            path_type = "Prefix"
            backend {
              service {
                name = kubernetes_service.rules_service.metadata[0].name
                port { number = 4012 }
              }
            }
          }
          path {
            path      = "/api/v1/lookup-tables"
            path_type = "Prefix"
            backend {
              service {
                name = kubernetes_service.product_config.metadata[0].name
                port { number = 4010 }
              }
            }
          }
          path {
            path      = "/api/v1/mappings"
            path_type = "Prefix"
            backend {
              service {
                name = kubernetes_service.product_config.metadata[0].name
                port { number = 4010 }
              }
            }
          }
          path {
            path      = "/api/v1/product-lines"
            path_type = "Prefix"
            backend {
              service {
                name = kubernetes_service.product_config.metadata[0].name
                port { number = 4010 }
              }
            }
          }
          path {
            path      = "/api/v1/systems"
            path_type = "Prefix"
            backend {
              service {
                name = kubernetes_service.product_config.metadata[0].name
                port { number = 4010 }
              }
            }
          }
          path {
            path      = "/api/v1/scopes"
            path_type = "Prefix"
            backend {
              service {
                name = kubernetes_service.product_config.metadata[0].name
                port { number = 4010 }
              }
            }
          }
          path {
            path      = "/api/v1"
            path_type = "Prefix"
            backend {
              service {
                name = kubernetes_service.core_rating.metadata[0].name
                port { number = 4000 }
              }
            }
          }
          path {
            path      = "/"
            path_type = "Prefix"
            backend {
              service {
                name = kubernetes_service.rating_workspace.metadata[0].name
                port { number = 80 }
              }
            }
          }
        }
      }
    }
  }
}
