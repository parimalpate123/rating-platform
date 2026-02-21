import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrchestratorService } from './orchestrator.service';
import { OrchestratorController } from './orchestrator.controller';
import { ProductOrchestratorEntity, OrchestratorStepEntity } from '../entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProductOrchestratorEntity, OrchestratorStepEntity]),
  ],
  providers: [OrchestratorService],
  controllers: [OrchestratorController],
  exports: [OrchestratorService],
})
export class OrchestratorModule {}
