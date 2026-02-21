# AWS Secrets Manager — secret placeholders only. Do not put real values here.
# After apply, set values via CLI (see SECRETS.md):
#   aws secretsmanager put-secret-value --secret-id rating-platform/aws-credentials --secret-string '{"AWS_ACCESS_KEY_ID":"...", ...}'

resource "aws_secretsmanager_secret" "aws_credentials" {
  name                    = "rating-platform/aws-credentials"
  description             = "AWS credentials for rating-platform (e.g. CI or non-IRSA use). Set value via CLI."
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret" "db_credentials" {
  name                    = "rating-platform/db-credentials"
  description             = "PostgreSQL credentials for rating-platform. Set value via CLI."
  recovery_window_in_days = 7
}
