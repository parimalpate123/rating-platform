# Storing Secrets in AWS Secrets Manager

Do not put AWS Access Key (AK), Secret Key (SK), or database passwords in the repo or in `terraform.tfvars`. Use environment variables locally and store production secrets in AWS Secrets Manager. This doc gives the CLI commands to create and update those secrets.

**Local development:** Use `~/.aws/credentials` or env vars (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`). Never commit a `.env` file that contains real keys.

---

## Create secret for AWS credentials (e.g. CI or non-IRSA use)

One-time create. Replace `YOUR_AK`, `YOUR_SK`, and region as needed.

```bash
aws secretsmanager create-secret \
  --name "rating-platform/aws-credentials" \
  --description "AWS credentials for rating-platform (e.g. CI or local)" \
  --secret-string '{"AWS_ACCESS_KEY_ID":"YOUR_AK","AWS_SECRET_ACCESS_KEY":"YOUR_SK","AWS_REGION":"us-east-1"}'
```

## Update existing secret (rotation)

```bash
aws secretsmanager put-secret-value \
  --secret-id "rating-platform/aws-credentials" \
  --secret-string '{"AWS_ACCESS_KEY_ID":"NEW_AK","AWS_SECRET_ACCESS_KEY":"NEW_SK","AWS_REGION":"us-east-1"}'
```

---

## Optional — DB credentials in Secrets Manager

So Terraform or K8s (e.g. External Secrets) can pull DB credentials from Secrets Manager instead of tfvars:

```bash
aws secretsmanager create-secret \
  --name "rating-platform/db-credentials" \
  --description "PostgreSQL credentials for rating-platform" \
  --secret-string '{"DB_HOST":"your-rds-endpoint","DB_PORT":"5432","DB_NAME":"rating_platform","DB_USER":"rating_user","DB_PASS":"your-secure-password"}'
```

Update (rotation):

```bash
aws secretsmanager put-secret-value \
  --secret-id "rating-platform/db-credentials" \
  --secret-string '{"DB_HOST":"...","DB_PORT":"5432","DB_NAME":"rating_platform","DB_USER":"...","DB_PASS":"..."}'
```

---

## Retrieve for local use (export to env)

After retrieving, run the printed `export` lines in your shell. Requires `jq`.

```bash
aws secretsmanager get-secret-value --secret-id "rating-platform/aws-credentials" --query SecretString --output text | jq -r 'to_entries | map("export \(.key)=\(.value)") | .[]'
```

---

## EKS / production

- **Preferred:** Use IRSA (IAM Roles for Service Accounts) so pods get temporary credentials and you do not store AK/SK in Secrets Manager.
- If you must use static credentials in EKS, sync from Secrets Manager into a Kubernetes Secret (e.g. with External Secrets Operator or a one-off job) and mount as env in the deployment.
