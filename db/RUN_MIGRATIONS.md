# Running DB migrations

Migrations live in `db/migrations/*.sql`. They are applied by `scripts/run-migrations.sh` (local dev) or `scripts/run-migrations-rds.sh` (RDS from this workspace).

## Local dev (no RDS)

```bash
./scripts/start-infra.sh      # start Postgres in Docker
./scripts/run-migrations.sh   # uses localhost defaults; uses container if psql not installed
```

Do not use `run-migrations-rds.sh` for local dev; it reads RDS endpoint from Terraform and targets AWS.

---

## RDS (from this workspace)

Run from a machine that can reach RDS (e.g. VPN or bastion). Use the **RDS-only** script so local `run-migrations.sh` stays unchanged.

### Prereqs

- Terraform state available (Deploy workflow run at least once).
- PostgreSQL client: `brew install libpq && brew link --force libpq` (macOS) or `sudo apt-get install -y postgresql-client` (Linux).
- DB password (same as GitHub Secrets `DB_PASSWORD`).

### Run

From the **repository root**:

```bash
# Option A: set password in env
DB_PASS='your-db-password' ./scripts/run-migrations-rds.sh

# Option B: script will prompt for password (avoids shell history)
./scripts/run-migrations-rds.sh
```

The script reads `rds_endpoint` and `rds_port` from `infra/terraform` Terraform output and then runs the same migration logic as `run-migrations.sh` (it calls that script with the right env).

### Optional: run seeds after migrations

```bash
RUN_SEEDS=1 DB_PASS='...' ./scripts/run-migrations-rds.sh
```

### Manual env (no Terraform output)

If you prefer not to use Terraform output, set all vars and call the original script:

```bash
export DB_HOST="rating-platform-dev.xxxx.us-east-1.rds.amazonaws.com"
export DB_PORT="5432"
export DB_USER="rating_user"
export DB_PASS="your-password"
export DB_NAME="rating_platform"
./scripts/run-migrations.sh
```

---

## Run from AWS Console (CodeBuild)

You can run migrations from the AWS Console using CodeBuild. The job runs **inside your VPC**, so it can reach private RDS. No VPN or bastion on your machine.

### Prerequisites

1. **Terraform applied** with `create_codebuild_migrations = true` (default) and `create_rds = true`, so the project `rating-platform-migrations-{env}` and SSM parameters exist.
2. **Secret `rating-platform/db-credentials`** in Secrets Manager with at least the DB password, e.g.:
   ```json
   {"DB_PASS":"your-rds-password","DB_USER":"rating_user","DB_NAME":"rating_platform"}
   ```
   Set it via CLI:  
   `aws secretsmanager put-secret-value --secret-id rating-platform/db-credentials --secret-string '{"DB_PASS":"...","DB_USER":"rating_user","DB_NAME":"rating_platform"}'`
3. **GitHub connected** for the CodeBuild project (if the repo is private): CodeBuild → Your project → Edit → Source → Connect to GitHub (one-time).

### Steps

1. Open **AWS Console** → **CodeBuild** → **Build projects**.
2. Select **rating-platform-migrations-dev** (or your environment name).
3. Click **Start build** (optional: leave Branch empty to use default).
4. Wait for the build to complete. Logs show each migration file applied.

If the build fails, check CloudWatch Logs for the project and ensure the secret and SSM parameters are set (Terraform writes RDS endpoint/port to SSM on apply).
