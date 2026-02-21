# Namespace
resource "kubernetes_namespace" "main" {
  metadata {
    name = var.namespace
    labels = {
      "app.kubernetes.io/name"       = "rating-platform"
      "app.kubernetes.io/environment" = var.environment
    }
  }
}

# DB credentials secret (optional: only if db_* variables are set)
resource "kubernetes_secret" "db" {
  count = (var.db_host != "" && var.db_user != "" && var.db_password != "") ? 1 : 0

  metadata {
    name      = "rating-platform-db"
    namespace = kubernetes_namespace.main.metadata[0].name
  }
  data = {
    DB_HOST = var.db_host
    DB_PORT = var.db_port
    DB_NAME = var.db_name
    DB_USER = var.db_user
    DB_PASS = var.db_password
  }
  type = "Opaque"
}

# ConfigMap for non-sensitive env (inter-service URLs, ports)
resource "kubernetes_config_map" "app_env" {
  metadata {
    name      = "rating-platform-env"
    namespace = kubernetes_namespace.main.metadata[0].name
  }
  data = {
    NODE_ENV            = "production"
    LINE_RATING_URL     = "http://line-rating:4001"
    STATUS_SERVICE_URL   = "http://status-service:4013"
    TRANSFORM_SERVICE_URL = "http://transform-service:4011"
    RULES_SERVICE_URL   = "http://rules-service:4012"
    PRODUCT_CONFIG_URL  = "http://product-config:4010"
  }
}

# Core-rating deployment (first service to validate end-to-end)
locals {
  ecr_registry = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${data.aws_region.current.name}.amazonaws.com"
}

resource "kubernetes_deployment" "core_rating" {
  metadata {
    name      = "core-rating"
    namespace = kubernetes_namespace.main.metadata[0].name
    labels = {
      app = "core-rating"
    }
  }
  spec {
    replicas = 1
    selector {
      match_labels = {
        app = "core-rating"
      }
    }
    template {
      metadata {
        labels = {
          app = "core-rating"
        }
      }
      spec {
        container {
          name  = "core-rating"
          image = "${local.ecr_registry}/rating-platform/core-rating:${var.image_tag}"
          port {
            container_port = 4000
            name           = "http"
          }
          env_from {
            config_map_ref {
              name = kubernetes_config_map.app_env.metadata[0].name
            }
          }
          env {
            name  = "PORT"
            value = "4000"
          }
          liveness_probe {
            http_get {
              path = "/api/v1/health"
              port = 4000
            }
            initial_delay_seconds = 15
            period_seconds        = 20
          }
          readiness_probe {
            http_get {
              path = "/api/v1/health"
              port = 4000
            }
            initial_delay_seconds = 5
            period_seconds        = 10
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "core_rating" {
  metadata {
    name      = "core-rating"
    namespace = kubernetes_namespace.main.metadata[0].name
  }
  spec {
    selector = {
      app = "core-rating"
    }
    port {
      port        = 4000
      target_port = 4000
      name       = "http"
    }
    type = "ClusterIP"
  }
}
