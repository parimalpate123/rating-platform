import { Injectable, Logger } from '@nestjs/common';

export interface KafkaMessage {
  key?: string;
  payload: unknown;
  correlationId?: string;
  publishedAt: string;
}

@Injectable()
export class KafkaService {
  private readonly logger = new Logger(KafkaService.name);
  private readonly store = new Map<string, KafkaMessage[]>();

  publish(topic: string, message: Omit<KafkaMessage, 'publishedAt'>): { success: boolean; topic: string; offset: number } {
    if (!this.store.has(topic)) this.store.set(topic, []);
    const messages = this.store.get(topic)!;
    const entry: KafkaMessage = { ...message, publishedAt: new Date().toISOString() };
    messages.push(entry);
    const offset = messages.length - 1;
    this.logger.log(`Published to ${topic} (offset ${offset})`);
    return { success: true, topic, offset };
  }

  getTopics(): { topic: string; messageCount: number; lastPublishedAt: string | null }[] {
    const result: { topic: string; messageCount: number; lastPublishedAt: string | null }[] = [];
    for (const [topic, messages] of this.store.entries()) {
      result.push({
        topic,
        messageCount: messages.length,
        lastPublishedAt: messages.length > 0 ? messages[messages.length - 1].publishedAt : null,
      });
    }
    return result;
  }

  getMessages(topic: string, limit = 50): KafkaMessage[] {
    const messages = this.store.get(topic) ?? [];
    return messages.slice(-limit).reverse();
  }
}
