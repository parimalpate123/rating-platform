import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RegistryModule } from '../registry/registry.module';
import { ExecutionModule } from '../execution/execution.module';
import { HandlersModule } from '../handlers/handlers.module';
import { RatingModule } from '../rating/rating.module';
import { MockSystemsModule } from '../mock/mock-systems.module';
import { ScriptModule } from '../script/script.module';

@Module({
  imports: [RegistryModule, ExecutionModule, HandlersModule, RatingModule, MockSystemsModule, ScriptModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
