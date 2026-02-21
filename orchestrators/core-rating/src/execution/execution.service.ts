// ─── Execution Engine ───────────────────────────────────────────────────────
// Takes an orchestrator flow (list of steps) and executes them in order,
// passing the execution context through each step handler.

import { Injectable, Logger } from '@nestjs/common';
import { StepHandlerRegistry } from '../registry/step-handler.registry';

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

@Injectable()
export class ExecutionService {
  private readonly logger = new Logger(ExecutionService.name);

  constructor(private readonly registry: StepHandlerRegistry) {}

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

      const handler = this.registry.get(step.stepType);
      if (!handler) {
        this.logger.warn(`No handler registered for step type: ${step.stepType}`, request.correlationId);
        stepResults.push({
          stepId: step.id,
          stepType: step.stepType,
          stepName: step.name,
          status: 'skipped',
          durationMs: 0,
          error: `No handler registered for type: ${step.stepType}`,
        });
        continue;
      }

      const stepStart = Date.now();
      try {
        this.logger.log(`Executing step ${step.stepOrder}: ${step.name} (${step.stepType})`, request.correlationId);

        const result = await handler.execute(context, step.config);

        stepResults.push({
          stepId: step.id,
          stepType: step.stepType,
          stepName: step.name,
          status: result.status || 'completed',
          durationMs: Date.now() - stepStart,
          output: result.output,
        });

        if (result.status === 'failed') {
          const onFailure = (step.config as any)?.resilience?.onFailure || 'stop';
          if (onFailure === 'stop') {
            this.logger.error(`Step ${step.name} failed, halting execution`, request.correlationId);
            return {
              correlationId: request.correlationId,
              status: 'failed',
              stepResults,
              response: context.response,
              totalDurationMs: Date.now() - startTime,
            };
          }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Step ${step.name} threw: ${errorMsg}`, request.correlationId);

        stepResults.push({
          stepId: step.id,
          stepType: step.stepType,
          stepName: step.name,
          status: 'failed',
          durationMs: Date.now() - stepStart,
          error: errorMsg,
        });

        const onFailure = (step.config as any)?.resilience?.onFailure || 'stop';
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
