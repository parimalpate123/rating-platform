import axios from 'axios';

const lineRating = axios.create({ baseURL: '/api/line-rating' });

lineRating.interceptors.request.use((config) => {
  config.headers['x-correlation-id'] = crypto.randomUUID();
  return config;
});

export interface OrchestratorStep {
  id: string;
  orchestratorId: string;
  stepOrder: number;
  stepType: string;
  name: string;
  config: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
}

export interface ProductOrchestrator {
  id: string;
  productLineCode: string;
  name: string;
  status: string;
  steps: OrchestratorStep[];
  createdAt: string;
  updatedAt: string;
}

export interface RateResponse {
  transactionId: string;
  correlationId: string;
  productLineCode: string;
  status: 'completed' | 'failed';
  response: Record<string, unknown>;
  stepResults: Array<{
    stepId: string;
    stepType: string;
    stepName: string;
    status: string;
    durationMs: number;
    error?: string;
  }>;
  totalDurationMs: number;
}

const coreRating = axios.create({ baseURL: '/api/core-rating' });
coreRating.interceptors.request.use((config) => {
  config.headers['x-correlation-id'] = crypto.randomUUID();
  return config;
});

export const ratingApi = {
  rate: (productLineCode: string, payload: Record<string, unknown>, scope?: Record<string, string>) =>
    coreRating.post<RateResponse>(`/rate/${productLineCode}`, { payload, scope }).then(r => r.data),
};

export const orchestratorApi = {
  get: (code: string) => lineRating.get<ProductOrchestrator>(`/orchestrators/${code}`).then(r => r.data),
  delete: (code: string) => lineRating.delete(`/orchestrators/${code}`).then(r => r.data),
  autoGenerate: (code: string, targetFormat: 'xml' | 'json') =>
    lineRating.post<ProductOrchestrator>(`/orchestrators/${code}/auto-generate`, { targetFormat }).then(r => r.data),
  getSteps: (code: string) => lineRating.get<OrchestratorStep[]>(`/orchestrators/${code}/steps`).then(r => r.data),
  addStep: (code: string, data: Partial<OrchestratorStep>) =>
    lineRating.post<OrchestratorStep>(`/orchestrators/${code}/steps`, data).then(r => r.data),
  updateStep: (code: string, stepId: string, data: Partial<OrchestratorStep>) =>
    lineRating.put<OrchestratorStep>(`/orchestrators/${code}/steps/${stepId}`, data).then(r => r.data),
  deleteStep: (code: string, stepId: string) =>
    lineRating.delete(`/orchestrators/${code}/steps/${stepId}`).then(r => r.data),
  reorderSteps: (code: string, stepIds: string[]) =>
    lineRating.post(`/orchestrators/${code}/steps/reorder`, { stepIds }).then(r => r.data),
};
