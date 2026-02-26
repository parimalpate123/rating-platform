import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { executeTransform } from './transforms/transform-executor';

@Injectable()
export class FieldMappingHandler {
  readonly type = 'field_mapping';
  private readonly logger = new Logger(FieldMappingHandler.name);
  private readonly productConfigUrl = process.env['PRODUCT_CONFIG_URL'] || 'http://localhost:4010';

  async execute(context: any, config: any): Promise<any> {
    const start = Date.now();
    const direction = config.direction || 'request';

    // The input to this step is the source data it will read from
    const source = direction === 'request' ? context.request : context.response;

    try {
      let mapping: any = null;

      // Resolve mapping: step config is source of truth
      if (config.mappingId) {
        try {
          const { data } = await axios.get(
            `${this.productConfigUrl}/api/v1/mappings/${config.mappingId}`,
            { headers: { 'x-correlation-id': context.correlationId }, timeout: 30000 }
          );
          mapping = data;
        } catch {
          this.logger.warn(`Mapping ${config.mappingId} not found, falling back to direction lookup`);
        }
      }

      if (!mapping) {
        const { data: mappings } = await axios.get(
          `${this.productConfigUrl}/api/v1/mappings`,
          {
            params: { productLineCode: context.productLineCode },
            headers: { 'x-correlation-id': context.correlationId },
            timeout: 30000,
          }
        );
        mapping = mappings.find(
          (m: any) => m.direction === direction && (m.status === 'active' || m.status === 'draft')
        );
      }

      if (!mapping) {
        this.logger.log(`No ${direction} mapping found for ${context.productLineCode}`);
        return {
          status: 'completed',
          output: {
            serviceRequest: { direction, productLineCode: context.productLineCode, source },
            serviceResponse: { message: `No ${direction} mapping configured — passthrough`, fieldsApplied: 0 },
            httpStatus: 200,
          },
          durationMs: Date.now() - start,
        };
      }

      const { data: fields } = await axios.get(
        `${this.productConfigUrl}/api/v1/mappings/${mapping.id}/fields`,
        { headers: { 'x-correlation-id': context.correlationId }, timeout: 30000 }
      );

      const target = { ...context.working };
      let applied = 0;
      const fieldDetails: Array<{ source: string; target: string; value: unknown; transformationType?: string }> = [];
      const transformErrors: Array<{ field: string; type: string; error: string }> = [];
      const requiredFieldErrors: Array<{ field: string; error: string }> = [];

      for (const field of fields) {
        // 1. Skip logic
        if (field.transformConfig?.skipMapping) {
          if (field.transformConfig.skipBehavior === 'use_default' && field.defaultValue != null) {
            setNestedValue(target, field.targetPath, field.defaultValue);
            applied++;
            fieldDetails.push({ source: field.sourcePath, target: field.targetPath, value: field.defaultValue });
          }
          continue;
        }

        // 2. Extract source value
        let value = getNestedValue(source, field.sourcePath);

        // 3. Handle missing value
        if (value === undefined || value === null) {
          if (field.isRequired) {
            requiredFieldErrors.push({ field: field.sourcePath, error: 'Required field missing' });
            continue;
          }
          if (field.defaultValue != null) {
            value = field.defaultValue;
          } else {
            continue; // No value, no default → skip
          }
        }

        // 4. Apply transformation
        const result = executeTransform({
          value,
          transformationType: field.transformationType || 'direct',
          transformConfig: field.transformConfig || {},
          defaultValue: field.defaultValue,
          sourcePath: field.sourcePath,
          targetPath: field.targetPath,
          fullContext: context.working,
        });

        if (result.error) {
          this.logger.warn(
            `Transform error on field ${field.sourcePath} → ${field.targetPath} (${field.transformationType}): ${result.error}`
          );
          transformErrors.push({ field: field.sourcePath, type: field.transformationType || 'direct', error: result.error });
        }

        // 5. Set transformed value
        setNestedValue(target, field.targetPath, result.value);
        applied++;
        fieldDetails.push({
          source: field.sourcePath,
          target: field.targetPath,
          value: result.value,
          transformationType: field.transformationType,
        });
      }

      context.working = target;

      return {
        status: 'completed',
        output: {
          serviceRequest: { direction, mappingId: mapping.id, mappingName: mapping.name, source },
          serviceResponse: {
            fieldsApplied: applied,
            totalFields: fields.length,
            fieldDetails,
            ...(transformErrors.length > 0 && { transformErrors }),
            ...(requiredFieldErrors.length > 0 && { requiredFieldErrors }),
          },
          httpStatus: 200,
        },
        durationMs: Date.now() - start,
      };
    } catch (err) {
      this.logger.error(`FieldMappingHandler error: ${err}`);
      return {
        status: 'completed',
        output: {
          serviceRequest: { direction, source },
          serviceResponse: { error: String(err), message: 'Mapping service unavailable — passthrough' },
          httpStatus: 503,
        },
        durationMs: Date.now() - start,
      };
    }
  }

  validate(config: any) { return { valid: true }; }
}

function getNestedValue(obj: any, path: string): any {
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
