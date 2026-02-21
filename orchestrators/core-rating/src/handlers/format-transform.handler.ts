import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class FormatTransformHandler {
  readonly type = 'format_transform';
  private readonly logger = new Logger(FormatTransformHandler.name);
  private readonly transformUrl = process.env['TRANSFORM_SERVICE_URL'] || 'http://localhost:4011';

  async execute(context: any, config: any): Promise<any> {
    const start = Date.now();
    try {
      const { data: result } = await axios.post(`${this.transformUrl}/api/v1/transform`, {
        input: context.working,
        direction: config.formatDirection,
      });

      context.working = result.output;
      return {
        status: 'completed',
        output: { format: result.format },
        durationMs: Date.now() - start,
      };
    } catch (err) {
      this.logger.error(`FormatTransformHandler error: ${err}`);
      return { status: 'failed', error: String(err), durationMs: Date.now() - start };
    }
  }

  validate(config: any) {
    if (!config.formatDirection) return { valid: false, errors: ['formatDirection is required'] };
    return { valid: true };
  }
}
