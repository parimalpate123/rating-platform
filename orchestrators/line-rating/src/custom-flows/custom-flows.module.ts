import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomFlowEntity, CustomFlowStepEntity } from '../entities';
import { CustomFlowsService } from './custom-flows.service';
import { CustomFlowsController } from './custom-flows.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([CustomFlowEntity, CustomFlowStepEntity]),
  ],
  providers: [CustomFlowsService],
  controllers: [CustomFlowsController],
  exports: [CustomFlowsService],
})
export class CustomFlowsModule {}
