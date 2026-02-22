import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class PublishEventHandler {
  readonly type = 'publish_event';
  private readonly logger = new Logger(PublishEventHandler.name);
  private readonly kafkaAdapterUrl =
    process.env['KAFKA_ADAPTER_URL'] || 'http://localhost:3010';

  async execute(context: any, config: any): Promise<any> {
    const start = Date.now();
    const topic: string = config.topic || 'rating.event';
    const key: string | undefined = config.key;

    const payload = {
      correlationId: context.correlationId,
      transactionId: context.transactionId,
      productLineCode: context.productLineCode,
      scope: context.scope,
      result: context.response,
      publishedAt: new Date().toISOString(),
      ...(config.includeWorking ? { working: context.working } : {}),
    };

    this.logger.log(`publish_event: topic=${topic} correlationId=${context.correlationId}`);

    try {
      const { data } = await axios.post(
        `${this.kafkaAdapterUrl}/api/v1/publish`,
        { topic, key, payload, correlationId: context.correlationId },
        { timeout: 10000 },
      );
      return {
        status: 'completed',
        output: { topic, offset: data.offset, published: true, isMock: true },
        durationMs: Date.now() - start,
      };
    } catch (err: any) {
      this.logger.warn(
        `publish_event: Kafka adapter unreachable, falling back to log-only. ${err.message}`,
      );
      return {
        status: 'completed',
        output: { topic, published: false, fallback: 'log-only', error: err.message },
        durationMs: Date.now() - start,
      };
    }
  }

  validate(config: any) {
    if (!config.topic) return { valid: false, errors: ['topic is required'] };
    return { valid: true };
  }
}
