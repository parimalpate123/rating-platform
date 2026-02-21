// ─── Rating Service ──────────────────────────────────────────────────────────
// Orchestrates a full rating request end-to-end:
//   1. Fetch orchestrator steps from line-rating service
//   2. Create a transaction record in status-service
//   3. Execute all steps via ExecutionService
//   4. Update transaction with result + step logs
//   5. Return the final response

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { randomUUID } from 'crypto';
import { ExecutionService } from '../execution/execution.service';

export interface RateRequest {
  productLineCode: string;
  scope?: { state?: string; coverage?: string; transactionType?: string };
  payload: Record<string, unknown>;
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

@Injectable()
export class RatingService {
  private readonly logger = new Logger(RatingService.name);
  private readonly lineRatingUrl = process.env['LINE_RATING_URL'] || 'http://localhost:4001';
  private readonly statusUrl = process.env['STATUS_SERVICE_URL'] || 'http://localhost:4013';

  constructor(private readonly executionService: ExecutionService) {}

  async rate(request: RateRequest): Promise<RateResponse> {
    const correlationId = randomUUID();
    const startTime = Date.now();

    this.logger.log(`Rating request for ${request.productLineCode} [${correlationId}]`);

    // Step 1: Fetch orchestrator steps from line-rating
    let steps: any[] = [];
    try {
      const { data: orchestrator } = await axios.get(
        `${this.lineRatingUrl}/api/v1/orchestrators/${request.productLineCode}`,
        { headers: { 'x-correlation-id': correlationId } },
      );
      steps = orchestrator.steps || [];
    } catch (err: any) {
      if (err?.response?.status === 404) {
        throw new NotFoundException(
          `No orchestrator found for product line '${request.productLineCode}'. ` +
          `Go to the Orchestrator tab and click Auto-Generate Flow first.`,
        );
      }
      throw err;
    }

    if (steps.length === 0) {
      throw new NotFoundException(
        `Orchestrator for '${request.productLineCode}' has no steps configured.`,
      );
    }

    // Step 2: Create transaction in status-service
    let transactionId = correlationId;
    try {
      const { data: tx } = await axios.post(
        `${this.statusUrl}/api/v1/transactions`,
        {
          correlationId,
          productLineCode: request.productLineCode,
          status: 'PROCESSING',
          requestPayload: request.payload,
          scope: request.scope || {},
          stepCount: steps.filter((s: any) => s.isActive).length,
          completedSteps: 0,
        },
        { headers: { 'x-correlation-id': correlationId } },
      );
      transactionId = tx.id;
    } catch (err) {
      this.logger.warn(`Could not create transaction record: ${err} — continuing without tracking`);
    }

    // Step 3: Execute the pipeline
    const executionResult = await this.executionService.execute({
      correlationId,
      productLineCode: request.productLineCode,
      scope: request.scope,
      payload: request.payload,
      steps,
    });

    const totalDurationMs = Date.now() - startTime;

    // Step 4: Update transaction + write step logs
    try {
      await axios.put(
        `${this.statusUrl}/api/v1/transactions/${transactionId}`,
        {
          status: executionResult.status === 'completed' ? 'COMPLETED' : 'FAILED',
          responsePayload: executionResult.response,
          durationMs: totalDurationMs,
          completedSteps: executionResult.stepResults.filter((r) => r.status === 'completed').length,
          premiumResult: (executionResult.response as any)?.premium ?? null,
          errorMessage: executionResult.stepResults.find((r) => r.error)?.error ?? null,
        },
        { headers: { 'x-correlation-id': correlationId } },
      );

      // Write step logs
      for (const sr of executionResult.stepResults) {
        await axios.post(
          `${this.statusUrl}/api/v1/transactions/${transactionId}/steps`,
          {
            stepId: sr.stepId,
            stepType: sr.stepType,
            stepName: sr.stepName,
            stepOrder: steps.findIndex((s: any) => s.id === sr.stepId) + 1,
            status: sr.status.toUpperCase(),
            outputSnapshot: sr.output ?? null,
            errorMessage: sr.error ?? null,
            durationMs: sr.durationMs,
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          },
          { headers: { 'x-correlation-id': correlationId } },
        );
      }
    } catch (err) {
      this.logger.warn(`Could not update transaction record: ${err}`);
    }

    this.logger.log(
      `Rating ${executionResult.status} for ${request.productLineCode} in ${totalDurationMs}ms [${correlationId}]`,
    );

    return {
      transactionId,
      correlationId,
      productLineCode: request.productLineCode,
      status: executionResult.status,
      response: executionResult.response,
      stepResults: executionResult.stepResults,
      totalDurationMs,
    };
  }
}
