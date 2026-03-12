import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { StepHandlerRegistry } from '../registry/step-handler.registry';

/**
 * RunCustomFlowHandler — 'run_custom_flow' step type
 *
 * Config:
 *   customFlowId: string — ID of the custom flow to run (fetched from line-rating)
 *
 * Fetches flow + steps from line-rating GET /api/v1/custom-flows/:id,
 * then runs each step with the same context (request, working).
 */
@Injectable()
export class RunCustomFlowHandler {
  readonly type = 'run_custom_flow';
  private readonly logger = new Logger(RunCustomFlowHandler.name);
  private readonly lineRatingUrl =
    process.env['LINE_RATING_URL'] || 'http://localhost:4001';

  constructor(private readonly registry: StepHandlerRegistry) {}

  async execute(context: any, config: any): Promise<any> {
    const customFlowId = config.customFlowId as string;
    if (!customFlowId) {
      return {
        status: 'failed',
        output: { error: 'customFlowId is required' },
      };
    }

    const url = `${this.lineRatingUrl}/api/v1/custom-flows/${customFlowId}`;
    let flow: { id: string; name: string; steps: Array<{ id: string; stepOrder: number; stepType: string; name: string; config: Record<string, unknown>; isActive: boolean }> };
    try {
      const { data } = await axios.get(url, {
        headers: { 'x-correlation-id': context.correlationId },
        timeout: 10000,
      });
      flow = data;
    } catch (err: any) {
      const msg = err.response?.status === 404
        ? `Custom flow ${customFlowId} not found`
        : err.message || String(err);
      this.logger.error(`run_custom_flow: fetch failed: ${msg}`, context.correlationId);
      return {
        status: 'failed',
        output: { error: msg, customFlowId },
      };
    }

    const steps = (flow.steps ?? []).filter((s: any) => s.isActive !== false).sort((a: any, b: any) => a.stepOrder - b.stepOrder);

    // Graph-based traversal (same logic as main execution loop)
    const stepMap = new Map(steps.map((s: any) => [s.id, s]));
    const stepByOrder = [...steps];
    let currentStepId: string | null = stepByOrder[0]?.id ?? null;
    const MAX_ITERATIONS = 100;
    let iterations = 0;
    let stepsExecuted = 0;

    while (currentStepId && iterations < MAX_ITERATIONS) {
      iterations++;
      const step = stepMap.get(currentStepId) as any;
      if (!step) break;

      const handler = this.registry.get(step.stepType);
      if (!handler) {
        this.logger.error(
          `run_custom_flow: no handler for step type '${step.stepType}' in flow ${flow.name}`,
          context.correlationId,
        );
        return {
          status: 'failed',
          output: { error: `No handler for type: ${step.stepType}`, stepName: step.name },
        };
      }

      let handlerNextStepId: string | null = null;
      try {
        this.logger.log(
          `run_custom_flow: executing step ${step.stepOrder}: ${step.name} (${step.stepType})`,
          context.correlationId,
        );
        const result = await handler.execute(context, step.config ?? {});
        handlerNextStepId = result?.nextStepId ?? null;
        stepsExecuted++;

        if (result?.status === 'failed') {
          return {
            status: 'failed',
            output: { ...result.output, stepName: step.name, customFlowId: flow.id },
          };
        }
      } catch (err: any) {
        const errorMsg = err.message || String(err);
        this.logger.error(
          `run_custom_flow: step ${step.name} threw: ${errorMsg}`,
          context.correlationId,
        );
        return {
          status: 'failed',
          output: { error: errorMsg, stepName: step.name, customFlowId: flow.id },
        };
      }

      // Determine next step
      if (handlerNextStepId) {
        currentStepId = handlerNextStepId;
      } else if (step.defaultNextStepId) {
        currentStepId = step.defaultNextStepId;
      } else {
        const currentIdx = stepByOrder.findIndex((s: any) => s.id === step.id);
        currentStepId = stepByOrder[currentIdx + 1]?.id ?? null;
      }
    }

    this.logger.log(
      `run_custom_flow: completed ${flow.name} (${stepsExecuted} steps)`,
      context.correlationId,
    );
    return {
      status: 'completed',
      output: { customFlowId: flow.id, flowName: flow.name, stepsExecuted },
    };
  }

  validate(config: any) {
    if (!config.customFlowId || typeof config.customFlowId !== 'string') {
      return { valid: false, errors: ['customFlowId (string) is required'] };
    }
    return { valid: true };
  }
}
