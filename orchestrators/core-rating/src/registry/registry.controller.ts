import { Controller, Get } from '@nestjs/common';
import { StepHandlerRegistry } from './step-handler.registry';

@Controller('registry')
export class RegistryController {
  constructor(private readonly registry: StepHandlerRegistry) {}

  @Get('handlers')
  listHandlers() {
    return this.registry.list();
  }

  @Get('handlers/health')
  async handlersHealth() {
    return this.registry.healthCheckAll();
  }
}
