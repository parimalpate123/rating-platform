import { Controller, Post, Body } from '@nestjs/common';
import { ExecutionService, ExecutionRequest } from './execution.service';

@Controller('execute')
export class ExecutionController {
  constructor(private readonly executionService: ExecutionService) {}

  @Post()
  async execute(@Body() request: ExecutionRequest) {
    return this.executionService.execute(request);
  }
}
