// ─── System Adapter Contracts ───────────────────────────────────────────────
// Every external system (rating engine, enrichment, callback) is accessed
// through an adapter implementing this interface.

import type { HealthStatus } from './execution.js';

export type AdapterType =
  | 'rating_engine'
  | 'enrichment'
  | 'callback'
  | 'event_broker'
  | 'custom';

export type AdapterProtocol = 'rest' | 'soap' | 'grpc' | 'kafka' | 'mock';
export type AdapterFormat = 'json' | 'xml' | 'soap' | 'binary';

export interface AdapterInfo {
  code: string;
  name: string;
  type: AdapterType;
  protocol: AdapterProtocol;
  format: AdapterFormat;
  isActive: boolean;
  isMock: boolean;
}

export interface AdapterRequest {
  correlationId: string;
  payload: Record<string, unknown>;
  headers?: Record<string, string>;
  timeout?: number;
}

export interface AdapterResponse {
  status: number;
  payload: Record<string, unknown>;
  headers?: Record<string, string>;
  durationMs: number;
  raw?: string;
}

export interface SystemAdapter {
  readonly code: string;
  execute(request: AdapterRequest): Promise<AdapterResponse>;
  healthCheck(): Promise<HealthStatus>;
  getInfo(): AdapterInfo;
}
