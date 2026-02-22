// ─── Execution Engine ───────────────────────────────────────────────────────
// Takes an orchestrator flow (list of steps) and executes them in order,
// passing the execution context through each step handler.

import { Injectable, Logger } from '@nestjs/common';
import { StepHandlerRegistry } from '../registry/step-handler.registry';

// ── Local resilience / condition types (mirrors contracts package) ────────────

interface StepCondition {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in' | 'exists';
  value: unknown;
}

interface StepRetryConfig {
  maxAttempts: number;
  backoffMs: number;
  multiplier: number;
}

interface StepCircuitBreakerConfig {
  failureThreshold: number;
  resetAfterMs: number;
}

interface StepResilienceConfig {
  timeout?: number;
  retry?: StepRetryConfig;
  circuitBreaker?: StepCircuitBreakerConfig;
  onFailure?: 'stop' | 'skip' | 'use_default';
}

interface CircuitBreakerState {
  failures: number;
  openedAt?: number;
}

// ── Public interfaces ─────────────────────────────────────────────────────────

export interface ExecutionRequest {
  correlationId: string;
  productLineCode: string;
  scope?: { state?: string; coverage?: string; transactionType?: string };
  payload: Record<string, unknown>;
  steps: Array<{
    id: string;
    stepOrder: number;
    stepType: string;
    name: string;
    config: Record<string, unknown>;
    isActive: boolean;
  }>;
}

export interface StepResultEntry {
  stepId: string;
  stepType: string;
  stepName: string;
  status: 'completed' | 'failed' | 'skipped';
  durationMs: number;
  error?: string;
  output?: Record<string, unknown>;
}

export interface ExecutionResult {
  correlationId: string;
  status: 'completed' | 'failed';
  stepResults: StepResultEntry[];
  response: Record<string, unknown>;
  totalDurationMs: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class ExecutionService {
  private readonly logger = new Logger(ExecutionService.name);

  // In-memory circuit breaker state — keyed by step ID
  private readonly circuitBreakers = new Map<string, CircuitBreakerState>();

  constructor(private readonly registry: StepHandlerRegistry) {}

  // ── Condition evaluation ────────────────────────────────────────────────────

  private evaluateCondition(
    condition: StepCondition,
    working: Record<string, unknown>,
  ): boolean {
    const value = condition.field
      .split('.')
      .reduce((obj: any, key: string) => obj?.[key], working as any);

    switch (condition.operator) {
      case 'eq':      return value === condition.value;
      case 'neq':     return value !== condition.value;
      case 'gt':      return (value as number) > (condition.value as number);
      case 'gte':     return (value as number) >= (condition.value as number);
      case 'lt':      return (value as number) < (condition.value as number);
      case 'lte':     return (value as number) <= (condition.value as number);
      case 'in':      return Array.isArray(condition.value) && (condition.value as unknown[]).includes(value);
      case 'not_in':  return !Array.isArray(condition.value) || !(condition.value as unknown[]).includes(value);
      case 'exists':  return value !== undefined && value !== null;
      default:        return true;
    }
  }

  // ── Circuit breaker ─────────────────────────────────────────────────────────

  private isCircuitOpen(stepId: string, config: StepCircuitBreakerConfig): boolean {
    const state = this.circuitBreakers.get(stepId);
    if (!state || state.openedAt === undefined) return false;
    if (Date.now() - state.openedAt > config.resetAfterMs) {
      this.circuitBreakers.set(stepId, { failures: 0 });
      return false;
    }
    return true;
  }

  private recordCircuitSuccess(stepId: string): void {
    this.circuitBreakers.delete(stepId);
  }

  private recordCircuitFailure(stepId: string, threshold: number): void {
    const state = this.circuitBreakers.get(stepId) ?? { failures: 0 };
    const failures = state.failures + 1;
    this.circuitBreakers.set(stepId, {
      failures,
      openedAt: failures >= threshold ? Date.now() : state.openedAt,
    });
  }

  // ── Retry wrapper ───────────────────────────────────────────────────────────

  private async executeWithRetry(
    handler: any,
    context: any,
    config: any,
    retry?: StepRetryConfig,
  ): Promise<any> {
    const maxAttempts = retry?.maxAttempts ?? 1;
    const backoffMs = retry?.backoffMs ?? 1000;
    const multiplier = retry?.multiplier ?? 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await handler.execute(context, config);
      } catch (err) {
        if (attempt === maxAttempts) throw err;
        const delay = backoffMs * Math.pow(multiplier, attempt - 1);
        this.logger.warn(
          `Step attempt ${attempt}/${maxAttempts} failed, retrying in ${Math.round(delay)}ms`,
        );
        await new Promise<void>((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // ── Main execution loop ─────────────────────────────────────────────────────

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const startTime = Date.now();
    const stepResults: StepResultEntry[] = [];

    const context = {
      correlationId: request.correlationId,
      transactionId: request.correlationId,
      productLineCode: request.productLineCode,
      scope: request.scope || {},
      request: request.payload,
      working: { ...request.payload },
      enrichments: {},
      response: {},
      metadata: {
        stepResults,
        startedAt: new Date(),
        currentStep: 0,
      },
    };

    const activeSteps = request.steps
      .filter((s) => s.isActive)
      .sort((a, b) => a.stepOrder - b.stepOrder);

    for (const step of activeSteps) {
      context.metadata.currentStep = step.stepOrder;

      const resilience = (step.config as any)?.resilience as StepResilienceConfig | undefined;
      const onFailure = resilience?.onFailure ?? 'stop';

      // ── 1. Condition check ────────────────────────────────────────────────
      const condition = (step.config as any)?.condition as StepCondition | undefined;
      if (condition && !this.evaluateCondition(condition, context.working)) {
        this.logger.log(
          `Skipping step ${step.stepOrder}: ${step.name} — condition not met`,
          request.correlationId,
        );
        stepResults.push({
          stepId: step.id,
          stepType: step.stepType,
          stepName: step.name,
          status: 'skipped',
          durationMs: 0,
        });
        continue;
      }

      // ── 2. Circuit breaker check ──────────────────────────────────────────
      const cbConfig = resilience?.circuitBreaker;
      if (cbConfig && this.isCircuitOpen(step.id, cbConfig)) {
        this.logger.warn(
          `Circuit open for step ${step.name} — short-circuiting`,
          request.correlationId,
        );
        stepResults.push({
          stepId: step.id,
          stepType: step.stepType,
          stepName: step.name,
          status: 'failed',
          durationMs: 0,
          error: 'Circuit breaker open',
        });
        if (onFailure === 'stop') {
          return {
            correlationId: request.correlationId,
            status: 'failed',
            stepResults,
            response: context.response,
            totalDurationMs: Date.now() - startTime,
          };
        }
        continue;
      }

      // ── 3. Handler lookup ─────────────────────────────────────────────────
      const handler = this.registry.get(step.stepType);
      if (!handler) {
        this.logger.error(
          `No handler registered for step type: ${step.stepType}`,
          request.correlationId,
        );
        stepResults.push({
          stepId: step.id,
          stepType: step.stepType,
          stepName: step.name,
          status: 'failed',
          durationMs: 0,
          error: `No handler registered for type: ${step.stepType}`,
        });
        return {
          correlationId: request.correlationId,
          status: 'failed',
          stepResults,
          response: context.response,
          totalDurationMs: Date.now() - startTime,
        };
      }

      // ── 4. Execute (with retry) ───────────────────────────────────────────
      const stepStart = Date.now();
      try {
        this.logger.log(
          `Executing step ${step.stepOrder}: ${step.name} (${step.stepType})`,
          request.correlationId,
        );

        const result = await this.executeWithRetry(
          handler,
          context,
          step.config,
          resilience?.retry,
        );

        const stepDuration = Date.now() - stepStart;

        if (cbConfig) {
          result.status === 'failed'
            ? this.recordCircuitFailure(step.id, cbConfig.failureThreshold)
            : this.recordCircuitSuccess(step.id);
        }

        stepResults.push({
          stepId: step.id,
          stepType: step.stepType,
          stepName: step.name,
          status: result.status || 'completed',
          durationMs: stepDuration,
          output: result.output,
        });

        if (result.status === 'failed' && onFailure === 'stop') {
          this.logger.error(
            `Step ${step.name} failed, halting execution`,
            request.correlationId,
          );
          return {
            correlationId: request.correlationId,
            status: 'failed',
            stepResults,
            response: context.response,
            totalDurationMs: Date.now() - startTime,
          };
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Step ${step.name} threw: ${errorMsg}`, request.correlationId);

        if (cbConfig) {
          this.recordCircuitFailure(step.id, cbConfig.failureThreshold);
        }

        stepResults.push({
          stepId: step.id,
          stepType: step.stepType,
          stepName: step.name,
          status: 'failed',
          durationMs: Date.now() - stepStart,
          error: errorMsg,
        });

        if (onFailure === 'stop') {
          return {
            correlationId: request.correlationId,
            status: 'failed',
            stepResults,
            response: context.response,
            totalDurationMs: Date.now() - startTime,
          };
        }
      }
    }

    return {
      correlationId: request.correlationId,
      status: 'completed',
      stepResults,
      response: context.response,
      totalDurationMs: Date.now() - startTime,
    };
  }
}
