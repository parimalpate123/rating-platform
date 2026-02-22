import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LookupTableEntity } from '../entities/lookup-table.entity';
import { LookupEntryEntity } from '../entities/lookup-entry.entity';
import { LookupTablesController } from './lookup-tables.controller';
import { LookupTablesService } from './lookup-tables.service';

@Module({
  imports: [TypeOrmModule.forFeature([LookupTableEntity, LookupEntryEntity])],
  controllers: [LookupTablesController],
  providers: [LookupTablesService],
  exports: [LookupTablesService],
})
export class LookupTablesModule {}
