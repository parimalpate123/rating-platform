# Namespace
resource "kubernetes_namespace" "main" {
  metadata {
    name = var.namespace
    labels = {
      "app.kubernetes.io/name"        = "rating-platform"
      "app.kubernetes.io/environment" = var.environment
    }
  }
}

# DB credentials secret — uses RDS endpoint when create_rds=true, else var.db_host
resource "kubernetes_secret" "db" {
  count = (local.effective_db_host != "" && var.db_user != "" && var.db_password != "") ? 1 : 0

  metadata {
    name      = "rating-platform-db"
    namespace = kubernetes_namespace.main.metadata[0].name
  }
  data = {
    DB_HOST = local.effective_db_host
    DB_PORT = var.db_port
    DB_NAME = var.db_name
    DB_USER = var.db_user
    DB_PASS = var.db_password
  }
  type = "Opaque"
}

# ConfigMap for non-sensitive env (inter-service URLs, ports, adapter URLs)
resource "kubernetes_config_map" "app_env" {
  metadata {
    name      = "rating-platform-env"
    namespace = kubernetes_namespace.main.metadata[0].name
  }
  data = {
    NODE_ENV              = "production"
    LINE_RATING_URL       = "http://line-rating:4001"
    STATUS_SERVICE_URL    = "http://status-service:4013"
    TRANSFORM_SERVICE_URL = "http://transform-service:4011"
    RULES_SERVICE_URL     = "http://rules-service:4012"
    PRODUCT_CONFIG_URL    = "http://product-config:4010"
    ADAPTER_KAFKA_URL     = "http://adapter-kafka:3010"
    ADAPTER_DNB_URL       = "http://adapter-dnb:3011"
    ADAPTER_GW_URL        = "http://adapter-gw:3012"
  }
}

# Core-rating deployment
resource "kubernetes_deployment" "core_rating" {
  metadata {
    name      = "core-rating"
    namespace = kubernetes_namespace.main.metadata[0].name
    labels = {
      app = "core-rating"
    }
  }
  spec {
    replicas = var.enable_hpa ? 1 : 2
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
          dynamic "env_from" {
            for_each = kubernetes_secret.db
            content {
              secret_ref {
                name = kubernetes_secret.db[0].metadata[0].name
              }
            }
          }
          env {
            name  = "PORT"
            value = "4000"
          }
          resources {
            requests = {
              cpu    = "100m"
              memory = "256Mi"
            }
            limits = {
              cpu    = "500m"
              memory = "512Mi"
            }
          }
          liveness_probe {
            http_get {
              path = "/api/v1/health"
              port = 4000
            }
            initial_delay_seconds = 15
            period_seconds        = 20
            failure_threshold     = 3
          }
          readiness_probe {
            http_get {
              path = "/api/v1/health"
              port = 4000
            }
            initial_delay_seconds = 5
            period_seconds        = 10
            failure_threshold     = 3
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
      name        = "http"
    }
    type = "ClusterIP"
  }
}
