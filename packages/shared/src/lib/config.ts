// ─── Config Helpers ─────────────────────────────────────────────────────────
// Typed environment variable access with defaults.

export function env(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value !== undefined) return value;
  if (defaultValue !== undefined) return defaultValue;
  throw new Error(`Missing required environment variable: ${key}`);
}

export function envInt(key: string, defaultValue?: number): number {
  const raw = process.env[key];
  if (raw !== undefined) {
    const parsed = parseInt(raw, 10);
    if (isNaN(parsed)) throw new Error(`Environment variable ${key} is not a valid integer: ${raw}`);
    return parsed;
  }
  if (defaultValue !== undefined) return defaultValue;
  throw new Error(`Missing required environment variable: ${key}`);
}

export function envBool(key: string, defaultValue?: boolean): boolean {
  const raw = process.env[key];
  if (raw !== undefined) return raw === 'true' || raw === '1';
  if (defaultValue !== undefined) return defaultValue;
  throw new Error(`Missing required environment variable: ${key}`);
}

// Service discovery — returns the base URL for a service
export function serviceUrl(serviceName: string): string {
  const envKey = `${serviceName.toUpperCase().replace(/-/g, '_')}_URL`;
  return env(envKey, `http://localhost:${getDefaultPort(serviceName)}`);
}

function getDefaultPort(service: string): number {
  const ports: Record<string, number> = {
    'core-rating': 4000,
    'line-rating': 4001,
    'product-config': 4010,
    'transform-service': 4011,
    'rules-service': 4012,
    'status-service': 4013,
  };
  return ports[service] || 3000;
}
