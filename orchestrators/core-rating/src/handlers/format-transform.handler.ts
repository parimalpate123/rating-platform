import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class FormatTransformHandler {
  readonly type = 'format_transform';
  private readonly logger = new Logger(FormatTransformHandler.name);
  private readonly transformUrl = process.env['TRANSFORM_SERVICE_URL'] || 'http://localhost:4011';

  async execute(context: any, config: any): Promise<any> {
    const start = Date.now();
    const requestBody = {
      input: context.working,
      direction: config.formatDirection,
    };

    try {
      const response = await axios.post(`${this.transformUrl}/api/v1/transform`, requestBody, {
        headers: { 'x-correlation-id': context.correlationId },
        timeout: 30000,
      });
      const result = response.data;

      context.working = result.output;

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
      this.logger.error(`FormatTransformHandler error: ${err.message}`);
      return {
        status: 'failed',
        error: err.message,
        output: {
          serviceRequest: requestBody,
          serviceResponse: { error: err.message },
          httpStatus: err?.response?.status ?? 503,
        },
        durationMs: Date.now() - start,
      };
    }
  }

  validate(config: any) {
    if (!config.formatDirection) return { valid: false, errors: ['formatDirection is required'] };
    return { valid: true };
  }
}
