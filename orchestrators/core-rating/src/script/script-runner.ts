/**
 * Script runner for run_script step and script test endpoint.
 * Runs user JavaScript in a sandbox with only request, working, response, scope.
 * No require, process, or I/O. Timeout enforced.
 */

import * as vm from 'node:vm';

const DEFAULT_TIMEOUT_MS = 5000;
const MAX_TIMEOUT_MS = 30000;

function deepClone(obj: Record<string, unknown>): Record<string, unknown> {
  try {
    return JSON.parse(JSON.stringify(obj ?? {})) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export interface ScriptRunnerInput {
  scriptSource: string;
  request: Record<string, unknown>;
  working?: Record<string, unknown>;
  response?: Record<string, unknown>;
  scope?: Record<string, unknown>;
  timeoutMs?: number;
}

export interface ScriptRunnerResult {
  success: boolean;
  working?: Record<string, unknown>;
  response?: Record<string, unknown>;
  error?: string;
  durationMs: number;
}

/**
 * Run user script in a sandbox. Script receives (request, working, response, scope)
 * and may mutate working and response in place. No I/O; no require/process.
 */
export function runScript(input: ScriptRunnerInput): ScriptRunnerResult {
  const start = Date.now();
  const request = deepClone(input.request);
  const working = deepClone(input.working ?? input.request);
  const response = deepClone(input.response ?? {});
  const scope = deepClone((input.scope ?? {}) as Record<string, unknown>);

  const rawSource = (input.scriptSource ?? '').trim();
  if (!rawSource) {
    return {
      success: false,
      error: 'scriptSource is required',
      durationMs: Date.now() - start,
    };
  }

  let timeoutMs = typeof input.timeoutMs === 'number' ? input.timeoutMs : DEFAULT_TIMEOUT_MS;
  timeoutMs = Math.min(MAX_TIMEOUT_MS, Math.max(100, timeoutMs));

  // User code is the function body; we wrap so it receives (request, working, response, scope)
  const wrappedCode = `
    (function(request, working, response, scope) {
      ${rawSource}
    })(request, working, response, scope);
  `;

  const context = vm.createContext({
    request,
    working,
    response,
    scope,
  });

  try {
    vm.runInNewContext(wrappedCode, context, {
      timeout: timeoutMs,
      displayErrors: true,
    });
    return {
      success: true,
      working: context.working as Record<string, unknown>,
      response: context.response as Record<string, unknown>,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: message,
      durationMs: Date.now() - start,
    };
  }
}
