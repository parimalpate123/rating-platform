// ─── Execution Context & Step Results ───────────────────────────────────────
// The execution context flows through every step in the orchestrator pipeline.

import type { StepConfig } from './orchestrator.js';

export interface ExecutionScope {
  state?: string;
  coverage?: string;
  transactionType?: string;
}

export interface ExecutionContext {
  correlationId: string;
  transactionId: string;
  productLineCode: string;
  scope: ExecutionScope;
  request: Record<string, unknown>;
  working: Record<string, unknown>;
  enrichments: Record<string, unknown>;
  response: Record<string, unknown>;
  metadata: {
    stepResults: StepResult[];
    startedAt: Date;
    currentStep: number;
  };
}

export interface StepResult {
  stepId: string;
  stepType: string;
  stepName: string;
  status: 'completed' | 'failed' | 'skipped';
  output?: Record<string, unknown>;
  error?: string;
  durationMs: number;
  metadata?: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

export interface HealthStatus {
  healthy: boolean;
  service: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

// ─── Step Handler Interface ─────────────────────────────────────────────────
// Every step type must implement this interface.

export interface StepHandler {
  readonly type: string;
  execute(context: ExecutionContext, config: StepConfig): Promise<StepResult>;
  validate(config: StepConfig): ValidationResult;
  healthCheck?(): Promise<HealthStatus>;
}
