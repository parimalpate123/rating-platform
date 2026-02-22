import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class ApplyRulesHandler {
  readonly type = 'apply_rules';
  private readonly logger = new Logger(ApplyRulesHandler.name);
  private readonly rulesUrl = process.env['RULES_SERVICE_URL'] || 'http://localhost:4012';

  async execute(context: any, config: any): Promise<any> {
    const start = Date.now();
    const requestBody = {
      correlationId: context.correlationId,
      productLineCode: context.productLineCode,
      scope: context.scope,
      phase: config.scope || 'pre_rating',
      context: context.working,
    };

    try {
      const response = await axios.post(`${this.rulesUrl}/api/v1/rules/evaluate`, requestBody, {
        headers: { 'x-correlation-id': context.correlationId },
        timeout: 30000,
      });
      const result = response.data;

      if (result.modifiedFields && Object.keys(result.modifiedFields).length > 0) {
        Object.assign(context.working, result.modifiedFields);
      }

      return {
        status: 'completed',
        output: {
          serviceRequest: requestBody,
          serviceResponse: result,
          httpStatus: response.status,
        },
        durationMs: Date.now() - start,
      };
    } catch (err: any) {
      this.logger.warn(`ApplyRulesHandler: rules service error: ${err.message}`);
      return {
        status: 'completed',
        output: {
          serviceRequest: requestBody,
          serviceResponse: { error: err.message, message: 'Rules service unavailable' },
          httpStatus: err?.response?.status ?? 503,
        },
        durationMs: Date.now() - start,
      };
    }
  }

  validate(config: any) { return { valid: true }; }
}
