import { statusService } from './client';

export interface Transaction {
  id: string;
  correlationId: string;
  productLineCode: string;
  status: 'RECEIVED' | 'VALIDATING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  scope?: { state?: string; coverage?: string; transactionType?: string };
  requestPayload?: Record<string, unknown> | null;
  responsePayload?: Record<string, unknown> | null;
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
  policyNumber?: string;
  accountNumber?: string;
  instanceId?: string;
  correlationId?: string;
}

function toQueryParams(p?: TransactionListParams): Record<string, string> {
  if (!p) return {}
  const out: Record<string, string> = {}
  const keys: (keyof TransactionListParams)[] = [
    'productLineCode', 'status', 'from', 'to',
    'policyNumber', 'accountNumber', 'instanceId', 'correlationId',
  ]
  for (const k of keys) {
    const v = p[k]
    if (v != null && String(v).trim() !== '') out[k] = String(v).trim()
  }
  return out
}

export const transactionsApi = {
  list: (params?: TransactionListParams) =>
    statusService.get<Transaction[]>('/transactions', { params: toQueryParams(params) }).then(r => r.data),
  get: (id: string) => statusService.get<Transaction>(`/transactions/${id}`).then(r => r.data),
  getSteps: (id: string) => statusService.get<StepLog[]>(`/transactions/${id}/steps`).then(r => r.data),
};
