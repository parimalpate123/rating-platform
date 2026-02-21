// ─── Standard Error Classes ─────────────────────────────────────────────────
// Used across all services for consistent error handling.

export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly code: string = 'INTERNAL_ERROR',
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, identifier: string) {
    super(`${entity} '${identifier}' not found`, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

export class StepExecutionError extends AppError {
  constructor(
    stepName: string,
    stepType: string,
    cause: string,
    public readonly stepId?: string,
  ) {
    super(`Step '${stepName}' (${stepType}) failed: ${cause}`, 500, 'STEP_EXECUTION_ERROR', { stepName, stepType, stepId });
    this.name = 'StepExecutionError';
  }
}

export class ExternalServiceError extends AppError {
  constructor(
    serviceName: string,
    statusCode: number,
    cause: string,
  ) {
    super(`External service '${serviceName}' returned ${statusCode}: ${cause}`, 502, 'EXTERNAL_SERVICE_ERROR', { serviceName });
    this.name = 'ExternalServiceError';
  }
}
