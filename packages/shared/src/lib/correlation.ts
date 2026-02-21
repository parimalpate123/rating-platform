// ─── Correlation ID ─────────────────────────────────────────────────────────
// Propagated through all service calls via X-Correlation-ID header.

import { randomUUID } from 'crypto';

const HEADER_NAME = 'x-correlation-id';

export function generateCorrelationId(): string {
  return randomUUID();
}

export function getCorrelationHeader(): string {
  return HEADER_NAME;
}
