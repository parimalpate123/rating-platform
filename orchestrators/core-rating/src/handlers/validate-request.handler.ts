import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ValidateRequestHandler {
  readonly type = 'validate_request';
  private readonly logger = new Logger(ValidateRequestHandler.name);

  async execute(context: any, config: any): Promise<any> {
    const start = Date.now();
    const payload = context.working || {};
    const schema = config.schema || 'default';
    const strict = config.strictMode === 'true' || config.strictMode === true;

    this.logger.log(
      `Validating request payload (schema: ${schema}, strict: ${strict})`,
      context.correlationId,
    );

    const errors: string[] = [];

    if (!payload || typeof payload !== 'object' || Object.keys(payload).length === 0) {
      errors.push('Request payload is empty or not an object');
    }

    if (config.requiredFields) {
      const required: string[] = Array.isArray(config.requiredFields)
        ? config.requiredFields
        : String(config.requiredFields).split(',').map((f: string) => f.trim());

      for (const field of required) {
        const value = field.split('.').reduce((obj: any, key: string) => obj?.[key], payload);
        if (value === undefined || value === null || value === '') {
          errors.push(`Missing required field: ${field}`);
        }
      }
    }

    if (strict && config.allowedFields) {
      const allowed: string[] = Array.isArray(config.allowedFields)
        ? config.allowedFields
        : String(config.allowedFields).split(',').map((f: string) => f.trim());
      const topLevelKeys = Object.keys(payload);
      for (const key of topLevelKeys) {
        if (!allowed.includes(key)) {
          errors.push(`Unexpected field in strict mode: ${key}`);
        }
      }
    }

    if (errors.length > 0) {
      this.logger.warn(
        `Validation failed with ${errors.length} error(s): ${errors.join('; ')}`,
        context.correlationId,
      );
      return {
        status: 'failed',
        output: {
          serviceRequest: { schema, strict, payload },
          serviceResponse: { valid: false, errors },
          httpStatus: 400,
          schema,
          fieldsValidated: Object.keys(payload).length,
        },
      };
    }

    this.logger.log(
      `Validation passed (${Object.keys(payload).length} fields)`,
      context.correlationId,
    );

    return {
      status: 'completed',
      output: {
        serviceRequest: { schema, strict, fieldCount: Object.keys(payload).length },
        serviceResponse: { valid: true, fieldsValidated: Object.keys(payload).length },
        httpStatus: 200,
        schema,
        fieldsValidated: Object.keys(payload).length,
      },
    };
  }

  validate(config: any) {
    return { valid: true };
  }

  async healthCheck() {
    return { healthy: true, details: { note: 'ValidateRequestHandler ready' } };
  }
}
