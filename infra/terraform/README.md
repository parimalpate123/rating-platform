# Rating Platform — Terraform (Existing EKS)

Provisions ECR repositories, Kubernetes namespace, ConfigMap, optional DB Secret, and workloads for the rating-platform on an **existing** EKS cluster. It does not create the cluster or VPC.

## Prerequisites

- Terraform >= 1.0
- `kubectl` and `aws` CLI configured (or AWS provider env vars)
- An existing EKS cluster; your kubeconfig should be able to access it (e.g. `aws eks update-kubeconfig --name <cluster_name>`)

## Usage

1. Copy the example tfvars and set your cluster name:
   ```bash
   cp terraform.tfvars.example terraform.tfvars
   # Edit terraform.tfvars: set cluster_name to your EKS cluster name
   ```

2. Initialize and apply:
   ```bash
   terraform init
   terraform plan -out=tfplan
   terraform apply tfplan
   ```

3. After apply, build and push images (see repo root `scripts/build-and-push.sh`), then update the deployment image tag if needed.

## Variables

| Variable       | Description                          | Default        |
|----------------|--------------------------------------|----------------|
| cluster_name   | **Required.** Existing EKS cluster name | —              |
| aws_region     | AWS region                           | us-east-1      |
| environment    | Environment label                    | dev            |
| namespace      | K8s namespace                        | rating-platform |
| image_tag      | Docker image tag for deployments     | latest         |
| db_host, db_port, db_name, db_user, db_password | Optional; if set, a K8s Secret is created for DB credentials | — |

## Outputs

- `ecr_repository_urls` — ECR repo URL per service (for `docker push`)
- `ecr_registry` — Registry host (e.g. `123456789.dkr.ecr.us-east-1.amazonaws.com`)
- `namespace` — Created Kubernetes namespace

## Secrets

Terraform creates empty AWS Secrets Manager secrets (`rating-platform/aws-credentials`, `rating-platform/db-credentials`). Do not put real values in Terraform. After apply, set values via CLI — see [SECRETS.md](SECRETS.md) for commands.
