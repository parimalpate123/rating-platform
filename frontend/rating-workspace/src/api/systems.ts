import { productConfig } from './client';

export type AuthMethod = 'none' | 'basic' | 'oauth2';

export interface SystemConfigAuth {
  username?: string;
  password?: string;
  clientId?: string;
  clientSecret?: string;
  tokenUrl?: string;
}

export interface System {
  id: string;
  code: string;
  name: string;
  type: 'source' | 'target' | 'both';
  format: 'json' | 'xml' | 'soap';
  protocol: 'rest' | 'soap' | 'grpc' | 'mock';
  baseUrl?: string;
  baseUrlProd?: string;
  authMethod?: AuthMethod;
  isMock: boolean;
  isActive: boolean;
  config?: { auth?: SystemConfigAuth };
}

export interface HealthCheckResult {
  systemId: string;
  status: string;
  system: string;
  timestamp: string;
  statusCode?: number;
  durationMs?: number;
  error?: string;
}

export const systemsApi = {
  list: () => productConfig.get<System[]>('/systems').then(r => r.data),
  get: (id: string) => productConfig.get<System>(`/systems/${id}`).then(r => r.data),
  create: (data: Partial<System>) => productConfig.post<System>('/systems', data).then(r => r.data),
  update: (id: string, data: Partial<System>) => productConfig.put<System>(`/systems/${id}`, data).then(r => r.data),
  delete: (id: string) => productConfig.delete(`/systems/${id}`),
  healthCheck: (id: string) => productConfig.post<HealthCheckResult>(`/systems/${id}/health-check`).then(r => r.data),
};
