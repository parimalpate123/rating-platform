import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from '../database/database.module';
import { ProductLinesModule } from '../product-lines/product-lines.module';
import { SystemsModule } from '../systems/systems.module';
import { MappingsModule } from '../mappings/mappings.module';
import { ScopesModule } from '../scopes/scopes.module';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { LookupTablesModule } from '../lookup-tables/lookup-tables.module';

@Module({
  imports: [DatabaseModule, ProductLinesModule, SystemsModule, MappingsModule, ScopesModule, ActivityLogModule, LookupTablesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
