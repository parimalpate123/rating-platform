import { Controller, Post, Body } from '@nestjs/common';
import {
  TransformService,
  TransformRequest,
  TransformResponse,
} from './transform.service';

@Controller('transform')
export class TransformController {
  constructor(private readonly transformService: TransformService) {}

  @Post()
  transform(@Body() body: TransformRequest): TransformResponse {
    return this.transformService.transform(body);
  }
}
