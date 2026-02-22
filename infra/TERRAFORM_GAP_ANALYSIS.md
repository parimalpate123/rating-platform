# Terraform Gap Analysis — AWS Deployment Readiness
> **Date:** February 2026
> **Status:** Review Required Before Deploy
> **Scope:** All services including Phase 6 adapters

---

## Executive Summary

The Terraform configuration manages the **application layer only** — ECR repos, Kubernetes Deployments/Services/Ingress, ConfigMaps, and Secrets. It assumes EKS cluster, VPC, RDS, ALB, and all supporting infrastructure already exist. There are **5 critical gaps** that must be resolved before a production deploy, plus several production-hardening items.

---

## What Is Currently Defined

| Resource | Count | Status |
|---|---|---|
| ECR Repositories | 7 | ✓ Defined — missing 3 Phase 6 adapters |
| Kubernetes Deployments | 7 | ✓ Defined — missing 3 Phase 6 adapters |
| Kubernetes Services (ClusterIP) | 7 | ✓ Defined — missing 3 Phase 6 adapters |
| Kubernetes Ingress (ALB) | 1 | ✓ Defined — missing Phase 6 routes |
| ConfigMap (service URLs) | 1 | ✓ Defined — missing KAFKA_ADAPTER_URL |
| Secret (DB credentials) | 1 | ✓ Defined, conditional on db_* vars |
| AWS Secrets Manager placeholders | 2 | ✓ Created but values are empty |

---

## Gap 1 — CRITICAL: Phase 6 Adapter Services Not in Terraform

Three new services added in Phase 6 exist in code but have **no infrastructure definitions anywhere**.

**Missing for each adapter:**

| Item | adapter-kafka (3010) | adapter-dnb (3011) | adapter-gw (3012) |
|---|---|---|---|
| ECR repository | ✗ | ✗ | ✗ |
| Kubernetes Deployment | ✗ | ✗ | ✗ |
| Kubernetes Service | ✗ | ✗ | ✗ |
| Ingress route | ✗ | ✗ | ✗ |
| Dockerfile | ✗ | ✗ | ✗ |
| Entry in `build-and-push.sh` | ✗ | ✗ | ✗ |

### What needs to be added

**`ecr.tf`** — add to the `ecr_repos` list:
```hcl
"adapter-kafka",
"adapter-dnb",
"adapter-gw",
```

**`k8s-services.tf`** — add Deployment + Service block for each (port 3010, 3011, 3012 respectively; no DB secret needed; use shared ConfigMap).

**`k8s-services.tf` Ingress** — add routes:
```
/api/v1/kafka  → adapter-kafka:3010
/api/v1/dnb    → adapter-dnb:3011
/api/v1/gw     → adapter-gw:3012
```

**`k8s.tf` ConfigMap** — add:
```hcl
KAFKA_ADAPTER_URL = "http://adapter-kafka:3010"
DNB_ADAPTER_URL   = "http://adapter-dnb:3011"
GW_ADAPTER_URL    = "http://adapter-gw:3012"
```

**Each adapter needs a `Dockerfile`** (same pattern as transform-service):
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY dist/ ./dist/
COPY dist/package.json ./
RUN npm install --omit=dev --ignore-scripts
EXPOSE <port>
CMD ["node", "dist/main.js"]
```

**`build-and-push.sh`** — add all three to the services array.

---

## Gap 2 — CRITICAL: No EKS Cluster Provisioning

Terraform references an existing cluster via `data "aws_eks_cluster"` but **does not create one**. Before `terraform apply` can run, an EKS cluster must exist.

**Missing entirely:**
- VPC and subnets (or use existing VPC)
- EKS cluster resource (`aws_eks_cluster`)
- Node group (`aws_eks_node_group`) — instance type, min/max/desired counts
- IAM roles for cluster and node group
- Security groups (cluster ↔ nodes ↔ ALB)
- EKS add-ons: `vpc-cni`, `kube-proxy`, `coredns`

### Options

**Option A — Fully managed via Terraform (recommended)**
Create a new file `eks.tf` that provisions all of the above. Typical node group sizing for this platform:

| Environment | Instance Type | Desired | Min | Max |
|---|---|---|---|---|
| dev/staging | `t3.medium` | 2 | 1 | 4 |
| production | `t3.large` or `m5.large` | 3 | 2 | 6 |

**Option B — Use existing cluster**
Create the cluster manually or via `eksctl`, then set `cluster_name` in `terraform.tfvars`. This is the current implied approach.

**Required IAM roles (if creating via TF):**
- `aws_iam_role` for EKS cluster control plane
- `aws_iam_role` for EKS node group (needs `AmazonEKSWorkerNodePolicy`, `AmazonEKS_CNI_Policy`, `AmazonEC2ContainerRegistryReadOnly`)

---

## Gap 3 — CRITICAL: No RDS Provisioning

All DB-backed services (`line-rating`, `product-config`, `rules-service`, `status-service`) require PostgreSQL. Terraform only passes `DB_HOST/USER/PASS` via a Secret — it does not create the database.

**Missing:**
- `aws_db_instance` or `aws_rds_cluster` (Aurora)
- DB subnet group (`aws_db_subnet_group`)
- Security group allowing EKS nodes → RDS port 5432
- Parameter group for PostgreSQL 16
- Initial database creation (`rating_platform`)
- Migration execution step in CI/CD or Kubernetes Job

### Recommendation

Add `rds.tf`:
```hcl
resource "aws_db_instance" "main" {
  identifier        = "rating-platform-${var.environment}"
  engine            = "postgres"
  engine_version    = "16"
  instance_class    = "db.t3.medium"   # scale up for prod
  allocated_storage = 20
  db_name           = var.db_name
  username          = var.db_user
  password          = var.db_password
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  skip_final_snapshot    = var.environment != "production"
  deletion_protection    = var.environment == "production"
}
```

Also add a Kubernetes `Job` for running migrations post-deploy (or keep as manual `scripts/run-migrations.sh`).

---

## Gap 4 — CRITICAL: No ALB Ingress Controller

The Ingress resource uses `ingressClassName: alb` (AWS ALB Controller) but **the controller itself is not installed**. Without it, the Ingress resource is created but ignored — no load balancer is created and the app is unreachable.

**Missing:**
- `aws_iam_policy` for ALB controller (permission to create/manage ALBs)
- IAM Role for Service Account (IRSA) for the controller pod
- Helm release: `aws-load-balancer-controller`
- ALB Ingress annotations for certificate ARN, scheme, target type

### What needs to be added

**`alb-controller.tf`** (or add to `eks.tf`):
```hcl
# IRSA for ALB controller
resource "aws_iam_role" "alb_controller" { ... }
resource "aws_iam_policy" "alb_controller" { ... }  # AWS managed policy

# Install via Helm
resource "helm_release" "alb_controller" {
  name       = "aws-load-balancer-controller"
  repository = "https://aws.github.io/eks-charts"
  chart      = "aws-load-balancer-controller"
  namespace  = "kube-system"
  set { name = "clusterName"; value = var.cluster_name }
  set { name = "serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn"; value = aws_iam_role.alb_controller.arn }
}
```

**Ingress annotations needed** (in `k8s-services.tf`):
```hcl
annotations = {
  "kubernetes.io/ingress.class"                    = "alb"
  "alb.ingress.kubernetes.io/scheme"               = "internet-facing"  # or "internal"
  "alb.ingress.kubernetes.io/target-type"          = "ip"
  "alb.ingress.kubernetes.io/certificate-arn"      = var.acm_certificate_arn  # for HTTPS
  "alb.ingress.kubernetes.io/listen-ports"         = "[{\"HTTP\": 80}, {\"HTTPS\": 443}]"
  "alb.ingress.kubernetes.io/ssl-redirect"         = "443"
}
```

This requires adding `var.acm_certificate_arn` as a new variable.

---

## Gap 5 — CRITICAL: Remote State Disabled

Terraform state is stored locally (`terraform.tfstate`) — the S3 backend is commented out. This means:
- No team collaboration (state conflicts)
- No state locking (concurrent apply = corruption)
- State lost if machine changes

### Fix in `main.tf`

Uncomment and configure:
```hcl
backend "s3" {
  bucket         = "rating-platform-tf-state"   # create this S3 bucket first
  key            = "rating-platform/terraform.tfstate"
  region         = "us-east-1"
  dynamodb_table = "rating-platform-tf-locks"   # create this DynamoDB table first
  encrypt        = true
}
```

**Pre-requisites (one-time, done outside Terraform):**
```bash
aws s3api create-bucket --bucket rating-platform-tf-state --region us-east-1
aws dynamodb create-table --table-name rating-platform-tf-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

---

## Gap 6 — No Resource Requests/Limits (Production Risk)

All 10 Kubernetes Deployments have **no CPU or memory requests/limits** defined. This means:
- Pods can consume unlimited cluster resources
- Scheduler cannot make optimal placement decisions
- One runaway pod can starve all others

### Recommended values (add to each Deployment in k8s.tf and k8s-services.tf)

```hcl
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
```

Heavier services (`core-rating`, `rules-service`):
```hcl
resources {
  requests = { cpu = "200m"; memory = "512Mi" }
  limits   = { cpu = "1000m"; memory = "1Gi" }
}
```

---

## Gap 7 — No TLS / HTTPS

The Ingress currently routes HTTP only. No SSL certificate is configured.

**What's needed:**
1. ACM certificate for your domain (`aws_acm_certificate` + DNS validation)
2. New variable: `var.acm_certificate_arn`
3. Ingress annotation: `alb.ingress.kubernetes.io/certificate-arn`
4. SSL redirect (HTTP → HTTPS)
5. Domain name variable + Ingress host rule

### Add to `variables.tf`
```hcl
variable "domain_name" {
  type        = string
  default     = ""
  description = "Domain name for the ingress (e.g., rating.example.com)"
}

variable "acm_certificate_arn" {
  type        = string
  default     = ""
  description = "ACM certificate ARN for HTTPS"
}
```

---

## Gap 8 — No Observability

No monitoring, logging, or tracing is configured.

| Component | Status | Recommended Solution |
|---|---|---|
| Metrics | ✗ Missing | Prometheus + Grafana via Helm, or CloudWatch Container Insights |
| Centralized logging | ✗ Missing | Fluent Bit → CloudWatch Logs (built into EKS) |
| Distributed tracing | ✗ Missing | AWS X-Ray (sidecar or SDK) |
| Alerting | ✗ Missing | CloudWatch Alarms or PagerDuty |
| Dashboards | ✗ Missing | Grafana or CloudWatch Dashboards |

**Minimum for production:** Enable CloudWatch Container Insights on the EKS cluster (1-line config, no agents needed).

---

## Gap 9 — No IAM / RBAC

No IAM policies or Kubernetes RBAC are defined for:
- Service pods accessing AWS services (AWS Bedrock in rules-service, ECR, S3)
- Kubernetes inter-namespace access control
- CI/CD pipeline IAM user/role for deploying

**Minimum needed:**
- `aws_iam_role` + IRSA for `rules-service` (needs Bedrock access)
- `aws_iam_role` for CI/CD deployment (ECR push + EKS apply)
- K8s `ServiceAccount` annotations on pods that need AWS access

---

## Gap 10 — No Auto-Scaling

All pods run at exactly 1 replica. No Horizontal Pod Autoscaler is defined.

### Add HPA for high-traffic services

```hcl
resource "kubernetes_horizontal_pod_autoscaler_v2" "core_rating" {
  metadata { name = "core-rating"; namespace = kubernetes_namespace.main.metadata[0].name }
  spec {
    scale_target_ref {
      api_version = "apps/v1"
      kind        = "Deployment"
      name        = "core-rating"
    }
    min_replicas = 2
    max_replicas = 10
    metric {
      type = "Resource"
      resource {
        name = "cpu"
        target { type = "Utilization"; average_utilization = 70 }
      }
    }
  }
}
```

Apply HPA to: `core-rating`, `rules-service`, `product-config`.

---

## Gap 11 — Hardcoded Values to Parameterize

| Location | Hardcoded Value | Should Be Variable |
|---|---|---|
| `variables.tf` | `aws_region = "us-east-1"` | `var.aws_region` (already variable, remove default or make required) |
| `k8s.tf` ConfigMap | `NODE_ENV = "production"` | Already uses `var.environment` — change to `"production"` when env=prod |
| `k8s-services.tf` | `replicas = 1` (all services) | `var.replicas` per service, or HPA |
| `ecr.tf` | `image_tag_mutability = "MUTABLE"` | Consider `IMMUTABLE` for production |
| `k8s-services.tf` | Ingress class hardcoded `alb` | Already `var.ingress_class_name` — OK |
| `secrets.tf` | Secret names hardcoded | Consider prefixing with `var.environment` |

---

## Gap 12 — Missing Dockerfiles for Adapter Services

Three new adapter services have no Dockerfile (needed for `build-and-push.sh`):

- `services/adapters/kafka/Dockerfile`
- `services/adapters/dnb/Dockerfile`
- `services/adapters/gw/Dockerfile`

These follow the same pattern as `services/transform-service/Dockerfile`. Each adapter:
- Has no DB dependency (no TypeORM)
- Is stateless (in-memory only)
- Needs only Node.js runtime

---

## Prioritized Fix List

### Must-Fix Before Any Deploy

| # | Gap | Effort | Files to Change |
|---|---|---|---|
| 1 | Phase 6 adapters missing from Terraform + build | Medium | `ecr.tf`, `k8s-services.tf`, `k8s.tf`, `build-and-push.sh`, 3 Dockerfiles |
| 2 | EKS cluster provisioning | High | New `eks.tf`, `iam.tf` |
| 3 | RDS provisioning | Medium | New `rds.tf`, `security-groups.tf` |
| 4 | ALB Ingress Controller | Medium | New `alb-controller.tf` or `helm.tf`, Ingress annotations |
| 5 | Remote state (S3 backend) | Low | `main.tf` backend block + manual S3/DynamoDB pre-create |

### Should-Fix Before Production

| # | Gap | Effort | Files to Change |
|---|---|---|---|
| 6 | Resource requests/limits | Low | `k8s.tf`, `k8s-services.tf` (all Deployments) |
| 7 | TLS / HTTPS | Low-Medium | `variables.tf`, `k8s-services.tf` Ingress annotations, new `acm.tf` |
| 8 | Observability (basic) | Medium | CloudWatch Container Insights, `outputs.tf` |
| 9 | IAM / IRSA for services | Medium | New `iam.tf` |
| 10 | Auto-scaling (HPA) | Low | New `hpa.tf` |

### Nice-to-Have

| # | Gap | Notes |
|---|---|---|
| 11 | Hardcoded values → variables | Minor cleanup, low risk |
| 12 | Pod Disruption Budgets | New `pdb.tf` |
| 13 | Network Policies | New `network-policy.tf` |
| 14 | ECR lifecycle policies | Prevent unbounded image accumulation |
| 15 | DB migration Kubernetes Job | Automate schema migrations on deploy |

---

## Suggested File Structure After Fixes

```
infra/terraform/
├── main.tf                  # Provider + S3 backend (fix Gap 5)
├── variables.tf             # Add domain_name, acm_certificate_arn (Gap 7)
├── data.tf                  # Existing — no change
├── outputs.tf               # Add adapter ECR URLs (Gap 1)
├── ecr.tf                   # Add 3 adapter repos (Gap 1)
├── eks.tf                   # NEW — EKS cluster + node groups (Gap 2)
├── iam.tf                   # NEW — IAM roles for cluster, nodes, IRSA (Gaps 2, 9)
├── rds.tf                   # NEW — RDS PostgreSQL instance (Gap 3)
├── security-groups.tf       # NEW — SGs for EKS↔RDS, ALB (Gaps 2, 3, 4)
├── alb-controller.tf        # NEW — ALB Ingress Controller via Helm (Gap 4)
├── acm.tf                   # NEW — ACM certificate + DNS validation (Gap 7)
├── k8s.tf                   # Update ConfigMap + add resource limits (Gaps 1, 6)
├── k8s-services.tf          # Add adapters, TLS annotations, resource limits (Gaps 1, 6, 7)
├── hpa.tf                   # NEW — HPA for core-rating, rules, product-config (Gap 10)
├── secrets.tf               # Existing — no change needed
└── terraform.tfvars.example # Update with new variables
```

---

## Quick Reference: Current Service Port Map

| Service | Port | DB | ECR | K8s | Ingress Route |
|---|---|---|---|---|---|
| core-rating | 4000 | ✗ | ✓ | ✓ | `/api/v1` (catch-all) |
| line-rating | 4001 | ✓ | ✓ | ✓ | `/api/v1/orchestrators` |
| product-config | 4010 | ✓ | ✓ | ✓ | `/api/v1/product-lines`, `/api/v1/mappings`, `/api/v1/systems`, `/api/v1/scopes` |
| transform-service | 4011 | ✗ | ✓ | ✓ | `/api/v1/transform` |
| rules-service | 4012 | ✓ | ✓ | ✓ | `/api/v1/rules` |
| status-service | 4013 | ✓ | ✓ | ✓ | `/api/v1/transactions` |
| rating-workspace | 80 | ✗ | ✓ | ✓ | `/` |
| **adapter-kafka** | **3010** | **✗** | **✗ MISSING** | **✗ MISSING** | **✗ MISSING** |
| **adapter-dnb** | **3011** | **✗** | **✗ MISSING** | **✗ MISSING** | **✗ MISSING** |
| **adapter-gw** | **3012** | **✗** | **✗ MISSING** | **✗ MISSING** | **✗ MISSING** |
