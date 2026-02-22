import { statusService } from './client';

export interface Transaction {
  id: string;
  correlationId: string;
  productLineCode: string;
  status: 'RECEIVED' | 'VALIDATING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  scope?: { state?: string; coverage?: string; transactionType?: string };
  premiumResult?: number;
  errorMessage?: string;
  durationMs?: number;
  stepCount: number;
  completedSteps: number;
  createdAt: string;
  updatedAt: string;
}

export interface StepLog {
  id: string;
  stepType: string;
  stepName: string;
  stepOrder: number;
  status: string;
  durationMs: number;
  errorMessage?: string;
  outputSnapshot?: Record<string, unknown>;
  startedAt?: string;
  completedAt?: string;
}

export interface TransactionListParams {
  productLineCode?: string;
  status?: string;
  from?: string;
  to?: string;
}

export const transactionsApi = {
  list: (params?: TransactionListParams) =>
    statusService.get<Transaction[]>('/transactions', { params }).then(r => r.data),
  get: (id: string) => statusService.get<Transaction>(`/transactions/${id}`).then(r => r.data),
  getSteps: (id: string) => statusService.get<StepLog[]>(`/transactions/${id}/steps`).then(r => r.data),
};
