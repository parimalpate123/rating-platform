import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from '../database/database.module';
import { OrchestratorModule } from '../orchestrator/orchestrator.module';
import { CustomFlowsModule } from '../custom-flows/custom-flows.module';

@Module({
  imports: [DatabaseModule, OrchestratorModule, CustomFlowsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
