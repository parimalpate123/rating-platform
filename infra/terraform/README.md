# Rating Platform — Terraform

Provisions AWS infrastructure and Kubernetes workloads for the rating-platform. Supports both **existing EKS clusters** (default) and **creating a new cluster** via Terraform.

## Prerequisites

- Terraform >= 1.6
- `aws` CLI configured (or AWS provider env vars set)
- Docker (for `build-and-push.sh`)
- `kubectl` (for smoke tests after deploy)
- An existing EKS cluster OR set `create_eks_cluster = true` to provision one

**Terraform runner IAM:** The identity that runs `terraform apply` (your IAM user/role or GHA OIDC role) needs, in addition to CodeBuild/ECS/RDS etc., **EC2 read for VPC config**: `ec2:DescribeSecurityGroups`, `ec2:DescribeVpcs`, `ec2:DescribeSubnets`. CodeBuild validates the project’s VPC config using the caller’s credentials; without these, creating the migrations CodeBuild project fails with "Not authorized to perform DescribeSecurityGroups".

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

## Local deploy (one script)

From the **repo root**, a single script builds all images, pushes to ECR, and runs Terraform apply (same flow as the GitHub Actions deploy):

```bash
# One-time: copy tfvars and set db_password (and VPC/subnets if needed)
cp infra/terraform/terraform.tfvars.example infra/terraform/terraform.tfvars
# Edit infra/terraform/terraform.tfvars

# Full deploy (build + push + apply). Uses local Terraform state unless TF_STATE_BUCKET is set.
./scripts/local-deploy.sh
```

Optional env vars:

| Env | Purpose |
|-----|--------|
| `TF_STATE_BUCKET` | Use same S3 state as CI (bucket from `bootstrap-remote-state.sh`) |
| `ENVIRONMENT` | `dev` (default), `staging`, or `prod` — used for state key when using S3 |
| `TF_VAR_db_password` | RDS password (if not in `terraform.tfvars`) |
| `SKIP_BUILD=1` | Only Terraform apply; set `IMAGE_TAG` to an existing tag |
| `SKIP_TERRAFORM=1` | Only build and push images |
| `RUN_MIGRATIONS=1` | Run DB migrations before deploy |

Examples:

```bash
# Use same state as CI (after setting TF_STATE_BUCKET in GitHub and locally)
TF_STATE_BUCKET=rating-platform-tfstate-123456789 ./scripts/local-deploy.sh

# Deploy without rebuilding images
SKIP_BUILD=1 IMAGE_TAG=abc123 ./scripts/local-deploy.sh
```

## Remote state (required for CI)

The deploy workflow **requires** remote state so Terraform state is shared across runs. Without it, each run starts with empty state and fails with "already exists" errors.

### One-time setup

1. **Create the S3 bucket and DynamoDB table** (run once with AWS CLI configured for your deploy account/region):
   ```bash
   cd infra/terraform
   export AWS_REGION=us-east-1
   ./bootstrap-remote-state.sh
   ```
   This creates bucket `rating-platform-tfstate-<account-id>` (with versioning) and table `rating-platform-tfstate-locks`. The script prints the bucket name and the exact `terraform init` command to run next.

2. **Add a GitHub repo variable**: Settings → Secrets and variables → Actions → Variables → New variable:
   - Name: `TF_STATE_BUCKET`
   - Value: the bucket name printed by the script (e.g. `rating-platform-tfstate-551481644633`)

The workflow runs `terraform init` with `-backend-config=bucket=$TF_STATE_BUCKET`, `key=rating-platform/<env>/terraform.tfstate`, and the DynamoDB table above.

### If you already created resources without remote state ("already exists" errors)

State was lost (e.g. CI ran without `TF_STATE_BUCKET`), so Terraform wants to create resources that already exist. Fix it once by importing them:

1. **Create S3 bucket + DynamoDB table** (run `./bootstrap-remote-state.sh` in infra/terraform) and add the **`TF_STATE_BUCKET`** repo variable (see above).
2. **From your machine** (with AWS CLI and Terraform 1.5+ installed, and credentials for the same account):
   ```bash
   cd infra/terraform
   export AWS_REGION=us-east-1   # or your region
   # Use your REAL bucket name (same as TF_STATE_BUCKET in GitHub), not the literal "YOUR_TF_STATE_BUCKET"
   terraform init -input=false -reconfigure \
     -backend-config=bucket=YOUR_ACTUAL_BUCKET_NAME \
     -backend-config=key=rating-platform/dev/terraform.tfstate \
     -backend-config=region=us-east-1 \
     -backend-config=dynamodb_table=rating-platform-tfstate-locks \
     -backend-config=encrypt=true
   # Only after init succeeds:
   ./import-existing.sh dev
   ```
   The script imports IAM roles, CloudWatch log group, DB subnet group, Secrets Manager secrets, ALB security group, target groups, and Service Discovery namespace into state. If you see "Backend initialization required", init did not succeed—fix the init command (use your real bucket name and Terraform 1.5+).
3. **Re-run the Deploy workflow** in GitHub Actions. It will use the S3 state (because `TF_STATE_BUCKET` is set) and no longer try to create duplicates.

**Option B — Fresh start (dev only):** If this environment is disposable, delete the existing resources in the AWS console, set `TF_STATE_BUCKET`, then run the deploy workflow so Terraform creates everything and stores state in S3.

### Running DB migrations when RDS is in a private subnet

Migrations are not run from the Deploy workflow (the runner cannot reach private RDS). You can:

- **From AWS Console:** Run the CodeBuild project **rating-platform-migrations-{env}** (Start build). It runs inside the VPC and can reach RDS. See **[db/RUN_MIGRATIONS.md](../db/RUN_MIGRATIONS.md)** (section "Run from AWS Console").
- **From this workspace (VPN/bastion):** Use `scripts/run-migrations-rds.sh`. See **[db/RUN_MIGRATIONS.md](../db/RUN_MIGRATIONS.md)**.

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

**Avoiding intermittent 503 (ECS):** With a single task per service, any restart or failed health check leaves the ALB target group with no healthy targets, so the ALB returns 503. To fix this, `desired_count` defaults to **2** so there is always at least one healthy task when the other is restarting. ALB `unhealthy_threshold` is set to 5 (was 3) and ECS container `startPeriod` to 45s (was 15s) so tasks are not marked unhealthy too quickly. To reduce cost in dev you can set `desired_count = 1` in `terraform.tfvars` and accept occasional 503s during restarts.

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
