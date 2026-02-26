import axios from 'axios';
import { randomUUID } from '../lib/uuid';
import { addRetryInterceptor } from './client';

const lineRatingBase = typeof import.meta !== 'undefined' && import.meta.env?.DEV ? '/api/line-rating' : '/api/v1';
const lineRating = axios.create({ baseURL: lineRatingBase });

lineRating.interceptors.request.use((config) => {
  config.headers['x-correlation-id'] = randomUUID();
  return config;
});
addRetryInterceptor(lineRating);

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
  endpointPath: string;
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
    output?: Record<string, unknown>;
  }>;
  totalDurationMs: number;
}

const coreRatingBase = typeof import.meta !== 'undefined' && import.meta.env?.DEV ? '/api/core-rating' : '/api/v1';
const coreRating = axios.create({ baseURL: coreRatingBase });
coreRating.interceptors.request.use((config) => {
  config.headers['x-correlation-id'] = randomUUID();
  return config;
});
addRetryInterceptor(coreRating);

export const ratingApi = {
  rate: (
    productLineCode: string,
    payload: Record<string, unknown>,
    scope?: Record<string, string>,
    endpointPath?: string,
  ) => {
    const path = endpointPath && endpointPath !== 'rate'
      ? `/rate/${productLineCode}/${endpointPath}`
      : `/rate/${productLineCode}`;
    return coreRating.post<RateResponse>(path, { payload, scope }).then(r => r.data);
  },

  // Public product-first API: POST /{productCode}/rate[/{flowName}]
  ratePublic: (
    productLineCode: string,
    payload: Record<string, unknown>,
    scope?: Record<string, string>,
    flowName?: string,
  ) => {
    const path = flowName && flowName !== 'rate'
      ? `/${productLineCode}/rate/${flowName}`
      : `/${productLineCode}/rate`;
    return coreRating.post<RateResponse>(path, { payload, scope }).then(r => r.data);
  },
};

export const orchestratorApi = {
  getAll: (code: string) =>
    lineRating.get<ProductOrchestrator[]>(`/orchestrators/${code}`).then(r => r.data),

  get: (code: string, endpointPath: string) =>
    lineRating.get<ProductOrchestrator>(`/orchestrators/${code}/flow/${endpointPath}`).then(r => r.data),

  createFlow: (code: string, name: string, endpointPath: string) =>
    lineRating.post<ProductOrchestrator>(`/orchestrators/${code}/flows`, { name, endpointPath }).then(r => r.data),

  deleteFlow: (code: string, endpointPath: string) =>
    lineRating.delete(`/orchestrators/${code}/flow/${endpointPath}`).then(r => r.data),

  autoGenerate: (code: string, targetFormat: 'xml' | 'json', endpointPath = 'rate') =>
    lineRating.post<ProductOrchestrator>(`/orchestrators/${code}/auto-generate`, { targetFormat, endpointPath }).then(r => r.data),

  getSteps: (code: string, endpointPath: string) =>
    lineRating.get<OrchestratorStep[]>(`/orchestrators/${code}/flow/${endpointPath}/steps`).then(r => r.data),

  addStep: (code: string, endpointPath: string, data: Partial<OrchestratorStep>) =>
    lineRating.post<OrchestratorStep>(`/orchestrators/${code}/flow/${endpointPath}/steps`, data).then(r => r.data),

  updateStep: (code: string, endpointPath: string, stepId: string, data: Partial<OrchestratorStep>) =>
    lineRating.put<OrchestratorStep>(`/orchestrators/${code}/flow/${endpointPath}/steps/${stepId}`, data).then(r => r.data),

  deleteStep: (code: string, endpointPath: string, stepId: string) =>
    lineRating.delete(`/orchestrators/${code}/flow/${endpointPath}/steps/${stepId}`).then(r => r.data),

  reorderSteps: (code: string, endpointPath: string, stepIds: string[]) =>
    lineRating.post(`/orchestrators/${code}/flow/${endpointPath}/steps/reorder`, { stepIds }).then(r => r.data),
};
