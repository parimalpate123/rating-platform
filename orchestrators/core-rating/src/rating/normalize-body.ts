import type { RateRequest } from './rating.service';

/**
 * Accept both wrapped  { payload: {...}, scope: {...} }
 * and flat            { ...fields }  request bodies.
 *
 * If the body already has a `payload` key that is a plain object, use it
 * as-is. Otherwise hoist all top-level fields into `payload`, preserving
 * the optional `scope` key alongside it.
 */
export function normalizeBody(
  body: Record<string, unknown>,
): Omit<RateRequest, 'productLineCode' | 'endpointPath'> {
  if (
    body.payload !== undefined &&
    typeof body.payload === 'object' &&
    !Array.isArray(body.payload)
  ) {
    return body as Omit<RateRequest, 'productLineCode' | 'endpointPath'>;
  }
  const { scope, ...rest } = body as any;
  return { payload: rest, ...(scope ? { scope } : {}) };
}
