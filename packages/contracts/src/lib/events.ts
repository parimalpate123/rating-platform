// ─── Event Contracts ────────────────────────────────────────────────────────
// Events published to Kafka/SQS for async processing and observability.

export type EventType =
  | 'transaction.received'
  | 'transaction.completed'
  | 'transaction.failed'
  | 'step.started'
  | 'step.completed'
  | 'step.failed'
  | 'rating.requested'
  | 'rating.completed'
  | 'product.created'
  | 'product.updated'
  | 'orchestrator.generated';

export interface PlatformEvent<T = Record<string, unknown>> {
  id: string;
  type: EventType;
  correlationId: string;
  timestamp: string;
  source: string;
  payload: T;
}

export interface EventPublisher {
  publish(event: PlatformEvent): Promise<void>;
  publishBatch(events: PlatformEvent[]): Promise<void>;
}
