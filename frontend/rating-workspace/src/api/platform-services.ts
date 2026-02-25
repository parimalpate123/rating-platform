/**
 * InsuRateConnect platform services (backend/orchestrator) for health display.
 * Probe URL: in dev we hit proxy paths; in prod we hit /api/v1 paths (ALB routes by path).
 */

const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

export interface PlatformServiceDef {
  id: string;
  name: string;
  /** Path segment after /api/v1 (prod) or after /api/{serviceSlug} (dev) */
  path: string;
  /** Dev proxy prefix, e.g. 'core-rating' -> /api/core-rating */
  devSlug: string;
  usesAI: boolean;
}

export const PLATFORM_SERVICES: PlatformServiceDef[] = [
  { id: 'core-rating', name: 'Core Rating', path: 'health', devSlug: 'core-rating', usesAI: false },
  { id: 'line-rating', name: 'Line Rating (Orchestrator)', path: 'orchestrators/health', devSlug: 'line-rating', usesAI: false },
  { id: 'product-config', name: 'Product Config (Mapper)', path: 'product-lines', devSlug: 'product-config', usesAI: true },
  { id: 'transform', name: 'Transform Service', path: 'transform/health', devSlug: 'transform', usesAI: false },
  { id: 'rules', name: 'Rating Rules Service', path: 'rules', devSlug: 'rules', usesAI: true },
  { id: 'status', name: 'Status Service', path: 'transactions', devSlug: 'status', usesAI: false },
  { id: 'database', name: 'Database', path: 'db-health', devSlug: 'product-config', usesAI: false },
];

export function getPlatformServiceProbeUrl(svc: PlatformServiceDef): string {
  if (isDev) {
    return `/api/${svc.devSlug}/${svc.path}`;
  }
  return `/api/v1/${svc.path}`;
}

export interface PlatformHealthResult {
  id: string;
  name: string;
  usesAI: boolean;
  status: 'healthy' | 'unhealthy' | 'checking' | 'error';
  durationMs?: number;
  /** Optional extra detail, e.g. 'Auth required (HTTP 401)'. */
  detail?: string;
  error?: string;
}

export async function checkPlatformHealth(svc: PlatformServiceDef): Promise<Omit<PlatformHealthResult, 'name' | 'usesAI'> & { name: string; usesAI: boolean }> {
  const url = getPlatformServiceProbeUrl(svc);
  const start = performance.now();
  try {
    const res = await fetch(url, { method: 'GET', credentials: 'same-origin' });
    const durationMs = Math.round(performance.now() - start);
    // In deployed AWS environments, these endpoints may be auth-protected.
    // Treat 401/403 as "reachable" so we show service is up (but access is restricted).
    const reachable = res.ok || res.status === 401 || res.status === 403 || res.status === 405;
    const detail =
      res.status === 401 ? 'Auth required (HTTP 401)' :
      res.status === 403 ? 'Forbidden (HTTP 403)' :
      res.status === 405 ? 'Method not allowed (HTTP 405)' :
      undefined;
    return {
      id: svc.id,
      name: svc.name,
      usesAI: svc.usesAI,
      status: reachable ? 'healthy' : 'unhealthy',
      durationMs,
      detail,
      error: reachable ? undefined : `HTTP ${res.status}`,
    };
  } catch (e) {
    const durationMs = Math.round(performance.now() - start);
    const error = e instanceof Error ? e.message : 'Request failed';
    return {
      id: svc.id,
      name: svc.name,
      usesAI: svc.usesAI,
      status: 'error',
      durationMs,
      error,
    };
  }
}

export async function checkAllPlatformHealth(): Promise<PlatformHealthResult[]> {
  const results = await Promise.all(
    PLATFORM_SERVICES.map((svc) => checkPlatformHealth(svc)),
  );
  return results;
}
