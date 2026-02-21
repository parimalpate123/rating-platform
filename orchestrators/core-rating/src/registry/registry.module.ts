import { Module, Global } from '@nestjs/common';
import { StepHandlerRegistry } from './step-handler.registry';
import { RegistryController } from './registry.controller';

@Global()
@Module({
  providers: [StepHandlerRegistry],
  controllers: [RegistryController],
  exports: [StepHandlerRegistry],
})
export class RegistryModule {}
