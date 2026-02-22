# Rating Platform — Terraform

Provisions AWS infrastructure and Kubernetes workloads for the rating-platform. Supports both **existing EKS clusters** (default) and **creating a new cluster** via Terraform.

## Prerequisites

- Terraform >= 1.6
- `aws` CLI configured (or AWS provider env vars set)
- Docker (for `build-and-push.sh`)
- `kubectl` (for smoke tests after deploy)
- An existing EKS cluster OR set `create_eks_cluster = true` to provision one

## Quick Start

```bash
# 1. Copy and edit tfvars
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars — at minimum: cluster_name, vpc_id, subnet IDs, db_password

# 2. Initialize (backend config required; use same bucket as CI or a local one)
terraform init -backend-config=bucket=YOUR_STATE_BUCKET -backend-config=key=rating-platform/dev/terraform.tfstate -backend-config=region=us-east-1 -backend-config=dynamodb_table=rating-platform-tfstate-locks -backend-config=encrypt=true

# 3. Plan and review
terraform plan -out=tfplan

# 4. Apply
terraform apply tfplan
```

## Remote state (required for CI)

The deploy workflow **requires** remote state so Terraform state is shared across runs. Without it, each run starts with empty state and fails with "already exists" errors.

### One-time setup

1. **Create an S3 bucket** for state (e.g. `rating-platform-tfstate-551481644633`). Enable versioning (recommended).
2. **Create a DynamoDB table** for locking:
   - Name: `rating-platform-tfstate-locks`
   - Partition key: `LockID` (String)
   - Region: same as your deploy (e.g. `us-east-1`)
3. **Add a GitHub repo variable**: Settings → Secrets and variables → Actions → Variables → New variable:
   - Name: `TF_STATE_BUCKET`
   - Value: your S3 bucket name

The workflow runs `terraform init` with `-backend-config=bucket=$TF_STATE_BUCKET`, `key=rating-platform/<env>/terraform.tfstate`, and the DynamoDB table above.

### If you already created resources without remote state

You're seeing "already exists" because state was lost (e.g. local state on a previous runner). Options:

- **Option A — Import into new state (recommended):** Create the S3 bucket and DynamoDB table above, add `TF_STATE_BUCKET`, then run the deploy workflow once. It will still try to create and fail. From your machine (with AWS and Terraform configured), run `terraform init` with the same backend config, then **import** each resource that already exists, e.g.:
  ```bash
  cd infra/terraform
  terraform init -backend-config=bucket=YOUR_BUCKET -backend-config=key=rating-platform/dev/terraform.tfstate -backend-config=region=us-east-1 -backend-config=dynamodb_table=rating-platform-tfstate-locks -backend-config=encrypt=true
  terraform import 'aws_lb_target_group.frontend[0]' arn:aws:elasticloadbalancing:us-east-1:ACCOUNT:targetgroup/rp-frontend-dev/ID
  # ... repeat for each resource (see Terraform docs for import IDs)
  ```
- **Option B — Fresh start (dev only):** If this environment is disposable, delete the existing resources in the AWS console (or via CLI), add `TF_STATE_BUCKET` as above, then run the deploy workflow again so Terraform creates everything and stores state in S3.

## Two-Step First Apply (when create_eks_cluster = true)

When provisioning a new EKS cluster, run in two steps to avoid provider chicken-and-egg:

```bash
# Step 1: Create EKS cluster (no k8s resources yet)
terraform apply -target=aws_eks_cluster.main -target=aws_eks_node_group.main -target=aws_iam_openid_connect_provider.eks

# Step 2: Update kubeconfig and apply everything
aws eks update-kubeconfig --name <cluster_name> --region <aws_region>
terraform apply
```

## Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `cluster_name` | Yes | — | EKS cluster name (created or existing) |
| `vpc_id` | Yes | — | VPC where EKS and RDS run |
| `private_subnet_ids` | Yes | — | Private subnets (EKS nodes, RDS) |
| `public_subnet_ids` | Yes | — | Public subnets (ALB) |
| `aws_region` | No | us-east-1 | AWS region |
| `environment` | No | dev | Environment label |
| `create_eks_cluster` | No | false | Provision EKS cluster via Terraform |
| `eks_kubernetes_version` | No | 1.29 | EKS Kubernetes version |
| `eks_node_instance_type` | No | t3.medium | EC2 instance type for nodes |
| `create_rds` | No | true | Provision RDS PostgreSQL instance |
| `db_instance_class` | No | db.t3.medium | RDS instance class |
| `db_host` | No | "" | External DB host (when create_rds=false) |
| `db_name` | No | rating_platform | PostgreSQL DB name |
| `db_user` | No | rating_user | PostgreSQL user (sensitive) |
| `db_password` | No | "" | PostgreSQL password (sensitive). RDS forbids `/`, `@`, `"`, space — use e.g. letters, numbers, `- _ ! # $ & *` |
| `namespace` | No | rating-platform | Kubernetes namespace |
| `image_tag` | No | latest | Docker image tag for all services |
| `ingress_enabled` | No | true | Create Kubernetes Ingress |
| `ingress_class_name` | No | alb | Ingress class (alb\|nginx) |
| `ingress_scheme` | No | internet-facing | ALB scheme |
| `domain_name` | No | "" | Public domain for HTTPS |
| `acm_certificate_arn` | No | "" | ACM certificate ARN for TLS |
| `enable_hpa` | No | true | Enable Horizontal Pod Autoscaler |
| `hpa_min_replicas` | No | 2 | HPA minimum replicas |
| `hpa_max_replicas` | No | 6 | HPA maximum replicas |

## Files

| File | Purpose |
|---|---|
| `main.tf` | Providers (aws, kubernetes, helm, tls), shared locals |
| `variables.tf` | All input variables |
| `data.tf` | Data sources (caller identity, EKS cluster, OIDC) |
| `networking.tf` | Security groups (ALB, EKS nodes, RDS) |
| `eks.tf` | Optional EKS cluster + node group (create_eks_cluster=true) |
| `rds.tf` | Optional RDS PostgreSQL (create_rds=true) |
| `iam.tf` | IRSA roles: ALB controller, rules-service (Bedrock) |
| `alb-controller.tf` | Helm release for AWS Load Balancer Controller |
| `ecr.tf` | ECR repos for all services and adapters |
| `k8s.tf` | Namespace, ConfigMap, DB Secret, core-rating deployment |
| `k8s-services.tf` | All other deployments, services, Ingress |
| `hpa.tf` | Horizontal Pod Autoscalers |
| `secrets.tf` | AWS Secrets Manager placeholder secrets |
| `outputs.tf` | ECR URLs, RDS endpoint, ALB DNS, IAM role ARNs |

## Services Deployed

| Service | Port | ECR Repo |
|---|---|---|
| core-rating | 4000 | rating-platform/core-rating |
| line-rating | 4001 | rating-platform/line-rating |
| product-config | 4010 | rating-platform/product-config |
| transform-service | 4011 | rating-platform/transform-service |
| rules-service | 4012 | rating-platform/rules-service |
| status-service | 4013 | rating-platform/status-service |
| adapter-kafka | 3010 | rating-platform/adapter-kafka |
| adapter-dnb | 3011 | rating-platform/adapter-dnb |
| adapter-gw | 3012 | rating-platform/adapter-gw |
| rating-workspace (frontend) | 80 | rating-platform/rating-workspace |

## Outputs

- `ecr_repository_urls` — Map of service → ECR URL (for `docker push`)
- `ecr_registry` — ECR registry base URL
- `alb_dns_name` — ALB DNS name; create a CNAME from your domain to this
- `rds_endpoint` — RDS endpoint (or external db_host if create_rds=false)
- `alb_controller_role_arn` — IAM role for the ALB ingress controller
- `rules_service_role_arn` — IAM role for rules-service (Bedrock access)

## After Apply

```bash
# 1. Build and push images
IMAGE_TAG=1.0.0 ./scripts/build-and-push.sh

# 2. Re-apply with the new image tag
terraform apply -var "image_tag=1.0.0"

# 3. Smoke test
kubectl get pods -n rating-platform
kubectl get ingress -n rating-platform
```

## Secrets

AWS Secrets Manager placeholders are created for `rating-platform/aws-credentials` and `rating-platform/db-credentials`. Set real values via CLI after apply (see `SECRETS.md`). **Never put real credentials in Terraform files.**
