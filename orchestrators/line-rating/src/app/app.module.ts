import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OrchestratorModule } from '../orchestrator/orchestrator.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule, OrchestratorModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
