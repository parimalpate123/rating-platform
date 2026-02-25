/**
 * Optional: load AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY from Secrets Manager.
 * Only runs when USE_AWS_SECRETS_MANAGER=true (e.g. CI or when task role cannot use Bedrock).
 *
 * In AWS (ECS/Lambda), prefer IAM task role — no AK/SK needed; set AWS_REGION and the
 * SDK uses the default credential chain (task role). Use this only when you need static creds.
 *
 * Secret format: {"AWS_ACCESS_KEY_ID":"...","AWS_SECRET_ACCESS_KEY":"...","AWS_REGION":"us-east-1"}
 * Secret name: AWS_CREDENTIALS_SECRET_ID env or "rating-platform/aws-credentials"
 */

const REQUIRED_KEYS = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'] as const;

function validateSecret(parsed: Record<string, unknown>): { ok: true } | { ok: false; missing: string[] } {
  const missing = REQUIRED_KEYS.filter((k) => !parsed[k] || typeof parsed[k] !== 'string' || String(parsed[k]).trim() === '');
  if (missing.length > 0) return { ok: false, missing };
  return { ok: true };
}

const hasExplicitCreds = (): boolean =>
  !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);

export async function loadAwsCredentialsFromSecretsManager(): Promise<void> {
  if (process.env.USE_AWS_SECRETS_MANAGER !== 'true' || hasExplicitCreds()) return;

  const secretId = process.env.AWS_CREDENTIALS_SECRET_ID || 'rating-platform/aws-credentials';
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';

  try {
    const { SecretsManagerClient, GetSecretValueCommand } = await import(
      '@aws-sdk/client-secrets-manager'
    );
    const client = new SecretsManagerClient({ region });
    const res = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
    const raw = res.SecretString;
    if (!raw) {
      console.warn(`[loadAwsCredentials] Secret "${secretId}" has no SecretString. Bedrock will use heuristic if no other creds.`);
      return;
    }

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const validation = validateSecret(parsed);
    if (!validation.ok) {
      console.warn(
        `[loadAwsCredentials] Secret "${secretId}" missing or empty: ${validation.missing.join(', ')}. ` +
          `Expected JSON with AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and optionally AWS_REGION. Bedrock may fall back to heuristic.`
      );
      return;
    }

    process.env.AWS_ACCESS_KEY_ID = String(parsed.AWS_ACCESS_KEY_ID).trim();
    process.env.AWS_SECRET_ACCESS_KEY = String(parsed.AWS_SECRET_ACCESS_KEY).trim();
    if (parsed.AWS_REGION && String(parsed.AWS_REGION).trim())
      process.env.AWS_REGION = String(parsed.AWS_REGION).trim();
  } catch (e) {
    console.warn(
      `[loadAwsCredentials] Failed to load "${secretId}":`,
      e instanceof Error ? e.message : e,
      '— Bedrock will use heuristic if no other creds.'
    );
  }
}
