import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductLineEntity } from '../entities/product-line.entity';
import { SystemEntity } from '../entities/system.entity';
import { MappingEntity } from '../entities/mapping.entity';
import { FieldMappingEntity } from '../entities/field-mapping.entity';
import { ProductScopeEntity } from '../entities/product-scope.entity';
import { ActivityLogEntity } from '../entities/activity-log.entity';
import { LookupTableEntity } from '../entities/lookup-table.entity';
import { LookupEntryEntity } from '../entities/lookup-entry.entity';
import { UploadedFileEntity } from '../entities/uploaded-file.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env['DB_HOST'] || 'localhost',
      port: parseInt(process.env['DB_PORT'] || '5433'),
      username: process.env['DB_USER'] || 'rating_user',
      password: process.env['DB_PASS'] || 'rating_pass',
      database: process.env['DB_NAME'] || 'rating_platform',
      entities: [ProductLineEntity, SystemEntity, MappingEntity, FieldMappingEntity, ProductScopeEntity, ActivityLogEntity, LookupTableEntity, LookupEntryEntity, UploadedFileEntity],
      synchronize: false,
      logging: process.env['NODE_ENV'] !== 'production',
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
