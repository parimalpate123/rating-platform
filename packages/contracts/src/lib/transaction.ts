// ─── Transaction & Status Contracts ─────────────────────────────────────────
// Defines the lifecycle of a rating transaction through the system.

export type TransactionStatus =
  | 'RECEIVED'
  | 'VALIDATING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED';

export type StepStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'SKIPPED';

export interface Transaction {
  id: string;
  correlationId: string;
  productLineCode: string;
  status: TransactionStatus;
  requestPayload: Record<string, unknown>;
  responsePayload?: Record<string, unknown>;
  scope: {
    state?: string;
    coverage?: string;
    transactionType?: string;
  };
  premiumResult?: number;
  errorMessage?: string;
  durationMs?: number;
  stepCount: number;
  completedSteps: number;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionStepLog {
  id: string;
  transactionId: string;
  stepId: string;
  stepType: string;
  stepName: string;
  stepOrder: number;
  status: StepStatus;
  inputSnapshot?: Record<string, unknown>;
  outputSnapshot?: Record<string, unknown>;
  errorMessage?: string;
  durationMs: number;
  startedAt: string;
  completedAt?: string;
}
