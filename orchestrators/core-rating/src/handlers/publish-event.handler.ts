import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class PublishEventHandler {
  readonly type = 'publish_event';
  private readonly logger = new Logger(PublishEventHandler.name);

  async execute(context: any, config: any): Promise<any> {
    const start = Date.now();
    const topic = config.topic || 'rating.event';
    this.logger.log(`[MOCK] Publishing event to topic: ${topic} for ${context.correlationId}`);
    // In production: call kafka adapter
    return { status: 'completed', output: { topic, published: true }, durationMs: Date.now() - start };
  }

  validate(config: any) { return { valid: true }; }
}
