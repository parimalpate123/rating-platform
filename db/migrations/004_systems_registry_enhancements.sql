-- Systems Registry: prod URL, auth method, secret reference for monitoring and secure integration

ALTER TABLE systems
  ADD COLUMN IF NOT EXISTS base_url_prod VARCHAR(500),
  ADD COLUMN IF NOT EXISTS auth_method VARCHAR(30) DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS auth_secret_id VARCHAR(255);

COMMENT ON COLUMN systems.base_url_prod IS 'Production endpoint; base_url used for dev/local.';
COMMENT ON COLUMN systems.auth_method IS 'none | basic | bearer | api_key';
COMMENT ON COLUMN systems.auth_secret_id IS 'Reference to secret (e.g. AWS Secrets Manager ID); never store raw credentials.';
