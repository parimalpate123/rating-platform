import { Controller, Post, Get, Param, Body, Query } from '@nestjs/common';
import { KafkaService } from './kafka.service';

@Controller()
export class KafkaController {
  constructor(private readonly kafka: KafkaService) {}

  @Get('health')
  health() {
    return { status: 'ok', service: 'kafka-adapter' };
  }

  @Post('publish')
  publish(@Body() body: { topic: string; key?: string; payload: unknown; correlationId?: string }) {
    return this.kafka.publish(body.topic, { key: body.key, payload: body.payload, correlationId: body.correlationId });
  }

  @Get('topics')
  getTopics() {
    return this.kafka.getTopics();
  }

  @Get('topics/:topic/messages')
  getMessages(@Param('topic') topic: string, @Query('limit') limit?: string) {
    return this.kafka.getMessages(topic, limit ? parseInt(limit, 10) : 50);
  }
}
