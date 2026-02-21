import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class ApplyRulesHandler {
  readonly type = 'apply_rules';
  private readonly logger = new Logger(ApplyRulesHandler.name);
  private readonly rulesUrl = process.env['RULES_SERVICE_URL'] || 'http://localhost:4012';

  async execute(context: any, config: any): Promise<any> {
    const start = Date.now();
    try {
      const { data: result } = await axios.post(`${this.rulesUrl}/api/v1/rules/evaluate`, {
        correlationId: context.correlationId,
        productLineCode: context.productLineCode,
        scope: context.scope,
        phase: config.scope || 'pre_rating',
        context: context.working,
      });

      // Apply modified fields to working context
      if (result.modifiedFields && Object.keys(result.modifiedFields).length > 0) {
        Object.assign(context.working, result.modifiedFields);
      }

      return {
        status: 'completed',
        output: { rulesEvaluated: result.rulesEvaluated, rulesApplied: result.rulesApplied },
        durationMs: Date.now() - start,
      };
    } catch (err) {
      this.logger.warn(`ApplyRulesHandler: rules service unavailable, skipping`);
      return { status: 'skipped', output: { reason: 'rules service unavailable' }, durationMs: Date.now() - start };
    }
  }

  validate(config: any) { return { valid: true }; }
}
