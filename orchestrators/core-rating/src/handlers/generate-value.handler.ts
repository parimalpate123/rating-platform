import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

/**
 * GenerateValueHandler — 'generate_value' step type
 *
 * Config:
 *   targetPath: string   — path in context.working to write the value
 *   generator: 'uuid'    — only supported generator for now
 */
@Injectable()
export class GenerateValueHandler {
  readonly type = 'generate_value';
  private readonly logger = new Logger(GenerateValueHandler.name);

  async execute(context: any, config: any): Promise<any> {
    const targetPath = config.targetPath as string;
    const generator = config.generator as string;

    if (!targetPath) {
      return {
        status: 'failed',
        output: { error: 'targetPath is required' },
      };
    }

    let value: string;
    if (generator === 'uuid') {
      value = randomUUID();
    } else {
      this.logger.warn(`Unknown generator: ${generator}, defaulting to uuid`);
      value = randomUUID();
    }

    this.setByPath(context.working, targetPath, value);
    this.logger.log(
      `generate_value: wrote ${generator} at ${targetPath} for ${context.correlationId}`,
    );

    return {
      status: 'completed',
      output: { targetPath, generator, value },
    };
  }

  validate(config: any) {
    if (!config.targetPath || typeof config.targetPath !== 'string') {
      return { valid: false, errors: ['targetPath (string) is required'] };
    }
    if (config.generator && config.generator !== 'uuid') {
      return { valid: false, errors: ["generator must be 'uuid' (only supported value)"] };
    }
    return { valid: true };
  }

  private setByPath(obj: any, path: string, value: unknown): void {
    const parts = path.split('.');
    const last = parts.pop()!;
    const target = parts.reduce((cur: any, key: string) => {
      if (cur[key] == null || typeof cur[key] !== 'object') cur[key] = {};
      return cur[key];
    }, obj);
    target[last] = value;
  }
}
