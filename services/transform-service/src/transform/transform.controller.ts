import { Controller, Get, Post, Body } from '@nestjs/common';
import {
  TransformService,
  type TransformRequest,
  type TransformResponse,
} from './transform.service';

@Controller('transform')
export class TransformController {
  constructor(private readonly transformService: TransformService) {}

  @Get('health')
  health() {
    return { status: 'ok', service: 'transform-service', timestamp: new Date().toISOString() };
  }

  @Post()
  transform(@Body() body: TransformRequest): TransformResponse {
    return this.transformService.transform(body);
  }
}
