import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

/**
 * EnrichHandler — 'enrich' step type
 *
 * Config:
 * {
 *   lookups: [{
 *     sourceField: string,   // path in context.working to get the lookup key
 *     tableKey: string,      // lookup table name (within the product's tables)
 *     targetField: string,   // path in context.working to write result fields
 *   }]
 * }
 *
 * For each lookup:
 *  1. Read the key value from context.working at sourceField
 *  2. Call product-config GET /lookup-tables/by-name/:tableKey/lookup/:keyValue?productLineCode=...
 *  3. Merge returned value object into context.working at targetField
 */
@Injectable()
export class EnrichHandler {
  readonly type = 'enrich';
  private readonly logger = new Logger(EnrichHandler.name);
  private readonly productConfigUrl =
    process.env['PRODUCT_CONFIG_URL'] || 'http://localhost:4010';

  async execute(context: any, config: any): Promise<any> {
    const start = Date.now();
    const lookups: Array<{ sourceField: string; tableKey: string; targetField: string }> =
      config.lookups ?? [];

    this.logger.log(
      `enrich: ${lookups.length} lookup(s) for ${context.correlationId}`,
    );

    const results: Array<{ tableKey: string; key: string; found: boolean; targetField: string }> = [];

    for (const spec of lookups) {
      const keyValue = this.getByPath(context.working, spec.sourceField);
      if (keyValue === undefined || keyValue === null) {
        this.logger.warn(
          `enrich: sourceField '${spec.sourceField}' is empty, skipping lookup '${spec.tableKey}'`,
        );
        results.push({ tableKey: spec.tableKey, key: String(keyValue), found: false, targetField: spec.targetField });
        continue;
      }

      try {
        const url = `${this.productConfigUrl}/api/v1/lookup-tables/by-name/${encodeURIComponent(spec.tableKey)}/lookup/${encodeURIComponent(String(keyValue))}`;
        const { data } = await axios.get(url, {
          params: { productLineCode: context.productLineCode },
          headers: { 'x-correlation-id': context.correlationId },
          timeout: 10000,
        });

        if (data.found && data.value) {
          this.setByPath(context.working, spec.targetField, data.value);
          context.enrichments = context.enrichments ?? {};
          context.enrichments[spec.tableKey] = data.value;
          this.logger.log(`enrich: '${spec.tableKey}'[${keyValue}] → ${spec.targetField}`);
          results.push({ tableKey: spec.tableKey, key: String(keyValue), found: true, targetField: spec.targetField });
        } else {
          this.logger.warn(`enrich: no entry for '${spec.tableKey}'[${keyValue}]`);
          results.push({ tableKey: spec.tableKey, key: String(keyValue), found: false, targetField: spec.targetField });
        }
      } catch (err: any) {
        this.logger.error(`enrich: lookup failed for '${spec.tableKey}': ${err.message}`);
        results.push({ tableKey: spec.tableKey, key: String(keyValue), found: false, targetField: spec.targetField });
      }
    }

    return {
      status: 'completed',
      output: { lookups: results, durationMs: Date.now() - start },
      durationMs: Date.now() - start,
    };
  }

  validate(config: any) {
    if (!Array.isArray(config.lookups) || config.lookups.length === 0) {
      return { valid: false, errors: ['lookups array is required and must not be empty'] };
    }
    const errors: string[] = [];
    for (const l of config.lookups) {
      if (!l.sourceField) errors.push('each lookup requires sourceField');
      if (!l.tableKey) errors.push('each lookup requires tableKey');
      if (!l.targetField) errors.push('each lookup requires targetField');
    }
    return errors.length ? { valid: false, errors } : { valid: true };
  }

  // ── Path helpers ─────────────────────────────────────────────────────────────

  private getByPath(obj: any, path: string): unknown {
    return path.split('.').reduce((cur, key) => (cur != null ? cur[key] : undefined), obj);
  }

  private setByPath(obj: any, path: string, value: unknown): void {
    const parts = path.split('.');
    const last = parts.pop()!;
    const target = parts.reduce((cur, key) => {
      if (cur[key] == null || typeof cur[key] !== 'object') cur[key] = {};
      return cur[key];
    }, obj);
    target[last] = value;
  }
}
