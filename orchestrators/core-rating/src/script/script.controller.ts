import { Controller, Post, Body } from '@nestjs/common';
import { runScript } from './script-runner';

export interface ScriptRunRequestBody {
  scriptSource: string;
  request: Record<string, unknown>;
  working?: Record<string, unknown>;
  response?: Record<string, unknown>;
  scope?: Record<string, unknown>;
  timeoutMs?: number;
}

export interface ScriptRunResponse {
  working?: Record<string, unknown>;
  response?: Record<string, unknown>;
  error?: string;
  durationMs?: number;
}

/**
 * POST /script/run — run script with sample payload (test step without executing full flow).
 */
@Controller('script')
export class ScriptController {
  @Post('run')
  async run(@Body() body: ScriptRunRequestBody): Promise<ScriptRunResponse> {
    const result = runScript({
      scriptSource: body.scriptSource ?? '',
      request: body.request ?? {},
      working: body.working,
      response: body.response,
      scope: body.scope,
      timeoutMs: body.timeoutMs,
    });

    if (!result.success) {
      return {
        error: result.error,
        durationMs: result.durationMs,
      };
    }

    return {
      working: result.working,
      response: result.response,
      durationMs: result.durationMs,
    };
  }
}
