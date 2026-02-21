// ─── Structured Logger ──────────────────────────────────────────────────────
// JSON-structured logging with correlation ID support.

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  service: string;
  correlationId?: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

export function createLogger(service: string) {
  const log = (level: LogEntry['level'], message: string, data?: Record<string, unknown>, correlationId?: string) => {
    const entry: LogEntry = {
      level,
      message,
      service,
      correlationId,
      data,
      timestamp: new Date().toISOString(),
    };
    const output = JSON.stringify(entry);
    if (level === 'error') {
      console.error(output);
    } else if (level === 'warn') {
      console.warn(output);
    } else {
      console.log(output);
    }
  };

  return {
    debug: (msg: string, data?: Record<string, unknown>, correlationId?: string) => log('debug', msg, data, correlationId),
    info: (msg: string, data?: Record<string, unknown>, correlationId?: string) => log('info', msg, data, correlationId),
    warn: (msg: string, data?: Record<string, unknown>, correlationId?: string) => log('warn', msg, data, correlationId),
    error: (msg: string, data?: Record<string, unknown>, correlationId?: string) => log('error', msg, data, correlationId),
  };
}
