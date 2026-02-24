import axios from 'axios';
import { randomUUID } from '../lib/uuid';
import { addRetryInterceptor } from './client';

const lineRatingBase =
  typeof import.meta !== 'undefined' && import.meta.env?.DEV
    ? '/api/line-rating'
    : '/api/v1';
const lineRating = axios.create({ baseURL: lineRatingBase });

lineRating.interceptors.request.use((config) => {
  config.headers['x-correlation-id'] = randomUUID();
  return config;
});
addRetryInterceptor(lineRating);

export interface CustomFlowStep {
  id: string;
  customFlowId: string;
  stepOrder: number;
  stepType: string;
  name: string;
  config: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
}

export interface CustomFlow {
  id: string;
  name: string;
  description: string | null;
  scope: 'universal' | 'product';
  productLineCode: string | null;
  steps?: CustomFlowStep[];
  createdAt: string;
  updatedAt: string;
}

export const customFlowsApi = {
  list: (productLineCode?: string) =>
    lineRating
      .get<CustomFlow[]>(
        '/custom-flows' + (productLineCode ? `?productLineCode=${encodeURIComponent(productLineCode)}` : '')
      )
      .then((r) => r.data),

  get: (id: string) =>
    lineRating.get<CustomFlow>(`/custom-flows/${id}`).then((r) => r.data),

  create: (data: {
    name: string;
    description?: string | null;
    scope: 'universal' | 'product';
    productLineCode?: string | null;
  }) => lineRating.post<CustomFlow>('/custom-flows', data).then((r) => r.data),

  update: (
    id: string,
    data: Partial<Pick<CustomFlow, 'name' | 'description' | 'scope' | 'productLineCode'>>
  ) => lineRating.put<CustomFlow>(`/custom-flows/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    lineRating.delete(`/custom-flows/${id}`).then(() => undefined),

  getSteps: (flowId: string) =>
    lineRating
      .get<CustomFlowStep[]>(`/custom-flows/${flowId}/steps`)
      .then((r) => r.data),

  addStep: (
    flowId: string,
    data: {
      stepType: string;
      name: string;
      config?: Record<string, unknown>;
      stepOrder?: number;
    }
  ) =>
    lineRating
      .post<CustomFlowStep>(`/custom-flows/${flowId}/steps`, data)
      .then((r) => r.data),

  updateStep: (
    stepId: string,
    data: Partial<Pick<CustomFlowStep, 'name' | 'config' | 'isActive' | 'stepOrder' | 'stepType'>>
  ) =>
    lineRating
      .put<CustomFlowStep>(`/custom-flows/steps/${stepId}`, data)
      .then((r) => r.data),

  deleteStep: (stepId: string) =>
    lineRating.delete(`/custom-flows/steps/${stepId}`).then(() => undefined),

  reorderSteps: (flowId: string, stepIds: string[]) =>
    lineRating
      .post(`/custom-flows/${flowId}/steps/reorder`, { stepIds })
      .then(() => undefined),
};
