// ─── Step Handler Registry ──────────────────────────────────────────────────
// Central registry where all step handlers are registered and retrieved.
// Handlers are registered at startup; the execution engine retrieves them by type.

import { Injectable, Logger } from '@nestjs/common';

export interface StepHandler {
  readonly type: string;
  execute(context: any, config: any): Promise<any>;
  validate(config: any): { valid: boolean; errors?: string[] };
  healthCheck?(): Promise<{ healthy: boolean; details?: any }>;
}

export interface StepHandlerInfo {
  type: string;
  description?: string;
  registeredAt: string;
}

@Injectable()
export class StepHandlerRegistry {
  private readonly logger = new Logger(StepHandlerRegistry.name);
  private readonly handlers = new Map<string, StepHandler>();
  private readonly registeredAt = new Map<string, string>();

  register(handler: StepHandler): void {
    if (this.handlers.has(handler.type)) {
      this.logger.warn(`Overwriting existing handler for type: ${handler.type}`);
    }
    this.handlers.set(handler.type, handler);
    this.registeredAt.set(handler.type, new Date().toISOString());
    this.logger.log(`Registered step handler: ${handler.type}`);
  }

  get(type: string): StepHandler | undefined {
    return this.handlers.get(type);
  }

  has(type: string): boolean {
    return this.handlers.has(type);
  }

  list(): StepHandlerInfo[] {
    return Array.from(this.handlers.entries()).map(([type]) => ({
      type,
      registeredAt: this.registeredAt.get(type) || '',
    }));
  }

  async healthCheckAll(): Promise<Record<string, { healthy: boolean; details?: any }>> {
    const results: Record<string, { healthy: boolean; details?: any }> = {};
    for (const [type, handler] of this.handlers) {
      if (handler.healthCheck) {
        try {
          results[type] = await handler.healthCheck();
        } catch (err) {
          results[type] = { healthy: false, details: { error: String(err) } };
        }
      } else {
        results[type] = { healthy: true, details: { note: 'No health check defined' } };
      }
    }
    return results;
  }
}
