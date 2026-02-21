import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class FieldMappingHandler {
  readonly type = 'field_mapping';
  private readonly logger = new Logger(FieldMappingHandler.name);
  private readonly productConfigUrl = process.env['PRODUCT_CONFIG_URL'] || 'http://localhost:4010';

  async execute(context: any, config: any): Promise<any> {
    const start = Date.now();
    try {
      // Get mappings for this product line and direction
      const { data: mappings } = await axios.get(
        `${this.productConfigUrl}/api/v1/mappings`,
        { params: { productLineCode: context.productLineCode } }
      );

      // Filter by direction (request or response)
      const direction = config.direction || 'request';
      const mapping = mappings.find((m: any) => m.direction === direction && m.status === 'active');

      if (!mapping) {
        this.logger.log(`No active ${direction} mapping found for ${context.productLineCode} — skipping`);
        return { status: 'skipped', durationMs: Date.now() - start };
      }

      // Get field mappings
      const { data: fields } = await axios.get(
        `${this.productConfigUrl}/api/v1/mappings/${mapping.id}/fields`
      );

      // Apply field mappings: for each field, copy value from source path to target path in working data
      const source = direction === 'request' ? context.request : context.response;
      const target = { ...context.working };

      for (const field of fields) {
        const value = getNestedValue(source, field.sourcePath);
        if (value !== undefined) {
          setNestedValue(target, field.targetPath, value);
        } else if (field.defaultValue !== undefined) {
          setNestedValue(target, field.targetPath, field.defaultValue);
        }
      }

      context.working = target;
      return { status: 'completed', output: { fieldsApplied: fields.length }, durationMs: Date.now() - start };
    } catch (err) {
      this.logger.error(`FieldMappingHandler error: ${err}`);
      // Don't fail the pipeline if mappings aren't configured yet
      return { status: 'skipped', output: { reason: 'mapping service unavailable' }, durationMs: Date.now() - start };
    }
  }

  validate(config: any) { return { valid: true }; }
}

function getNestedValue(obj: any, path: string): any {
  // Handle simple dotted paths like "policy.insuredName" or "$.policy.insuredName"
  const cleanPath = path.replace(/^\$\./, '');
  return cleanPath.split('.').reduce((acc, key) => acc?.[key], obj);
}

function setNestedValue(obj: any, path: string, value: any): void {
  const cleanPath = path.replace(/^\$\./, '');
  const keys = cleanPath.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) current[keys[i]] = {};
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
}
