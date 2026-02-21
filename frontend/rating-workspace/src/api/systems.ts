import { productConfig } from './client';

export interface System {
  id: string;
  code: string;
  name: string;
  type: 'source' | 'target' | 'both';
  format: 'json' | 'xml' | 'soap';
  protocol: 'rest' | 'soap' | 'grpc' | 'mock';
  baseUrl?: string;
  isMock: boolean;
  isActive: boolean;
}

export const systemsApi = {
  list: () => productConfig.get<System[]>('/systems').then(r => r.data),
  get: (id: string) => productConfig.get<System>(`/systems/${id}`).then(r => r.data),
  create: (data: Partial<System>) => productConfig.post<System>('/systems', data).then(r => r.data),
  update: (id: string, data: Partial<System>) => productConfig.put<System>(`/systems/${id}`, data).then(r => r.data),
  healthCheck: (id: string) => productConfig.post(`/systems/${id}/health-check`).then(r => r.data),
};
