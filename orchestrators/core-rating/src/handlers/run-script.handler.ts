import { Injectable, Logger } from '@nestjs/common';
import { runScript } from '../script/script-runner';

/**
 * RunScriptHandler — 'run_script' step type.
 * Executes user-provided JavaScript in a sandbox to mutate working/response.
 * Config: scriptSource (required), timeoutMs (optional).
 */
@Injectable()
export class RunScriptHandler {
  readonly type = 'run_script';
  private readonly logger = new Logger(RunScriptHandler.name);

  async execute(context: any, config: any): Promise<any> {
    const start = Date.now();
    const scriptSource = config.scriptSource as string;
    const timeoutMs = config.timeoutMs != null ? Number(config.timeoutMs) : undefined;

    if (!scriptSource || typeof scriptSource !== 'string' || !scriptSource.trim()) {
      return {
        status: 'failed',
        output: { error: 'scriptSource is required' },
        durationMs: Date.now() - start,
      };
    }

    const result = runScript({
      scriptSource: scriptSource.trim(),
      request: (context.request ?? {}) as Record<string, unknown>,
      working: (context.working ?? {}) as Record<string, unknown>,
      response: (context.response ?? {}) as Record<string, unknown>,
      scope: (context.scope ?? {}) as Record<string, unknown>,
      timeoutMs,
    });

    if (!result.success) {
      this.logger.warn(`run_script failed: ${result.error}`, context.correlationId);
      return {
        status: 'failed',
        output: { error: result.error },
        durationMs: result.durationMs,
      };
    }

    context.working = result.working ?? context.working;
    context.response = result.response ?? context.response;

    return {
      status: 'completed',
      output: { durationMs: result.durationMs },
      durationMs: result.durationMs,
    };
  }

  validate(config: any): { valid: boolean; errors?: string[] } {
    const scriptSource = config?.scriptSource;
    if (scriptSource == null || typeof scriptSource !== 'string' || !String(scriptSource).trim()) {
      return { valid: false, errors: ['scriptSource (non-empty string) is required'] };
    }
    const timeoutMs = config?.timeoutMs;
    if (timeoutMs != null) {
      const n = Number(timeoutMs);
      if (Number.isNaN(n) || n < 100 || n > 30000) {
        return { valid: false, errors: ['timeoutMs must be between 100 and 30000'] };
      }
    }
    return { valid: true };
  }
}
