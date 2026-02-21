import { Module } from '@nestjs/common';
import { MockSystemsController } from './mock-systems.controller';

@Module({
  controllers: [MockSystemsController],
})
export class MockSystemsModule {}
